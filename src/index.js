import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import io from "socket.io-client";
import Peer from "simple-peer";

const socket = io("https://whiteboard-backend.onrender.com");

const App = () => {
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [message, setMessage] = useState("");

  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const canvasRef = useRef();
  const ctxRef = useRef();
  const drawing = useRef(false);
  const peerRef = useRef();

  useEffect(() => {
    socket.on("role", (r) => setRole(r));

    socket.on("signal", async ({ senderId, data }) => {
      if (role === "viewer" && peerRef.current) {
        peerRef.current.signal(data);
      }
    });

    socket.on("chat-message", (data) => {
      setChatMessages((prev) => [...prev, data]);
    });

    socket.on("drawing", (data) => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const { x, y } = data;
      ctx.lineTo(x, y);
      ctx.stroke();
    });

    socket.on("clear-canvas", () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    socket.on("new-viewer", (viewerId) => {
      if (role === "broadcaster") {
        const stream = localVideoRef.current.srcObject;
        const peer = new Peer({ initiator: true, trickle: false, stream });

        peer.on("signal", (data) => {
          socket.emit("signal", { targetId: viewerId, data });
        });

        peerRef.current = peer;
      }
    });

    return () => socket.disconnect();
  }, [role]);

  const handleLogin = async () => {
    if (!username) return;
    socket.emit("set-username", username);
    setLoggedIn(true);
  };

  useEffect(() => {
    if (!loggedIn || role !== "broadcaster") return;
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
      localVideoRef.current.srcObject = stream;
    });
  }, [role, loggedIn]);

  const sendMessage = () => {
    if (message.trim()) {
      socket.emit("chat-message", message);
      setMessage("");
    }
  };

  const startDraw = ({ nativeEvent }) => {
    const { offsetX, offsetY } = nativeEvent;
    ctxRef.current.beginPath();
    ctxRef.current.moveTo(offsetX, offsetY);
    drawing.current = true;
  };

  const draw = ({ nativeEvent }) => {
    if (!drawing.current) return;
    const { offsetX, offsetY } = nativeEvent;
    ctxRef.current.lineTo(offsetX, offsetY);
    ctxRef.current.stroke();
    socket.emit("drawing", { x: offsetX, y: offsetY });
  };

  const endDraw = () => {
    drawing.current = false;
    ctxRef.current.closePath();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    socket.emit("clear-canvas");
  };

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = 500;
    canvas.height = 500;
    const ctx = canvas.getContext("2d");
    ctx.lineCap = "round";
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;
    ctxRef.current = ctx;
  }, []);

  if (!loggedIn) {
    return (
      <div>
        <h2>請輸入暱稱：</h2>
        <input value={username} onChange={(e) => setUsername(e.target.value)} />
        <button onClick={handleLogin}>登入</button>
      </div>
    );
  }

  return (
    <div>
      <h3>角色：{role}</h3>
      <div style={{ display: "flex" }}>
        <div>
          <video ref={localVideoRef} autoPlay muted playsInline style={{ width: 300 }} />
          <video ref={remoteVideoRef} autoPlay playsInline style={{ width: 300 }} />
          <p>使用者：{username}</p>
        </div>
        <canvas
          ref={canvasRef}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          style={{ border: "1px solid black", marginLeft: "10px" }}
        />
        <button onClick={clearCanvas}>清除畫布</button>
      </div>
      <div>
        <h4>聊天室</h4>
        <div style={{ height: "100px", overflowY: "scroll", border: "1px solid gray" }}>
          {chatMessages.map((msg, idx) => (
            <div key={idx}>
              <b>{msg.user}：</b> {msg.message}
            </div>
          ))}
        </div>
        <input value={message} onChange={(e) => setMessage(e.target.value)} />
        <button onClick={sendMessage}>送出</button>
      </div>
    </div>
  );
};

const container = document.getElementById("root");
const root = createRoot(container);
root.render(<App />);