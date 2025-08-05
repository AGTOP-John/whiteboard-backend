
// ✅ 前端 WebRTC + 畫板 + 聊天 + 使用者名稱管理 + 角色分配
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import io from 'socket.io-client';

const socket = io("https://whiteboard-backend-1n0p.onrender.com", {
  transports: ["websocket"]
});

const App = () => {
  const [messages, setMessages] = useState([]);
  const [msgInput, setMsgInput] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState(null);
  const [connected, setConnected] = useState(false);

  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const drawing = useRef(false);
  const peerRef = useRef(null);
  const videoRef = useRef(null);

  // WebRTC 環境初始化
  useEffect(() => {
    socket.on('role', (r) => {
      setRole(r);
      setConnected(true);
    });

    socket.on('new viewer', async (viewerId) => {
      if (role !== 'broadcaster') return;
      const stream = videoRef.current.srcObject;
      const peer = new RTCPeerConnection();
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));

      peer.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit('ice-candidate', { targetId: viewerId, candidate: e.candidate });
        }
      };

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.emit('offer', { targetId: viewerId, sdp: offer });
      peerRef.current = peer;
    });

    socket.on('offer', async ({ sdp, senderId }) => {
      const peer = new RTCPeerConnection();
      peerRef.current = peer;

      peer.ontrack = (e) => {
        videoRef.current.srcObject = e.streams[0];
      };

      peer.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit('ice-candidate', { targetId: senderId, candidate: e.candidate });
        }
      };

      await peer.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit('answer', { targetId: senderId, sdp: answer });
    });

    socket.on('answer', ({ sdp }) => {
      peerRef.current?.setRemoteDescription(new RTCSessionDescription(sdp));
    });

    socket.on('ice-candidate', ({ candidate }) => {
      peerRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
    });
  }, [role]);

  // 聊天訊息處理
  useEffect(() => {
    socket.on('chat message', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });
  }, []);

  // 畫板事件與同步
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000';
    ctxRef.current = ctx;

    const start = (e) => {
      drawing.current = true;
      ctx.beginPath();
      ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    };

    const draw = (e) => {
      if (!drawing.current) return;
      ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
      ctx.stroke();
      socket.emit('draw', { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });
    };

    const end = () => {
      drawing.current = false;
    };

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', end);

    socket.on('draw', ({ x, y }) => {
      ctx.lineTo(x, y);
      ctx.stroke();
    });

    socket.on('clear', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    return () => {
      canvas.removeEventListener('mousedown', start);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', end);
    };
  }, []);

  const sendMessage = () => {
    if (msgInput) {
      socket.emit('chat message', `${username || '匿名'}：${msgInput}`);
      setMsgInput('');
    }
  };

  const clearCanvas = () => {
    socket.emit('clear');
  };

  const handleStart = async () => {
    const name = prompt("請輸入你的名稱");
    if (!name) return;
    setUsername(name);

    if (role === 'broadcaster') {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      videoRef.current.srcObject = stream;
      videoRef.current.muted = true;
    }
  };

  return (
    <div>
      <h2>多人會議系統 ({role || '尚未分配'})</h2>
      <video ref={videoRef} autoPlay playsInline style={{ width: '400px' }}></video>
      <canvas ref={canvasRef} width={500} height={400} style={{ border: '1px solid #333', display: 'block', marginTop: 10 }} />
      <br />
      <input value={msgInput} onChange={(e) => setMsgInput(e.target.value)} placeholder="輸入訊息..." />
      <button onClick={sendMessage}>送出</button>
      <button onClick={clearCanvas}>清除畫布</button>
      <button onClick={handleStart}>開始/啟用視訊</button>
      <ul>
        {messages.map((m, i) => (<li key={i}>{m}</li>))}
      </ul>
    </div>
  );
};

const root = createRoot(document.getElementById('root'));
root.render(<App />);
