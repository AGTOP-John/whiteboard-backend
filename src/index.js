
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import io from 'socket.io-client';

const socket = io();

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const chatRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [username, setUsername] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [color, setColor] = useState('#' + Math.floor(Math.random()*16777215).toString(16));

  useEffect(() => {
    if (!loggedIn) return;

    navigator.mediaDevices.getUserMedia({ video: true, audio: false }).then((stream) => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    });

    socket.on('chat message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    socket.on('draw', drawRemote);
    socket.on('clear', clearCanvas);
  }, [loggedIn]);

  const drawRemote = (data) => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.strokeStyle = data.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(data.from.x, data.from.y);
    ctx.lineTo(data.to.x, data.to.y);
    ctx.stroke();
  };

  const clearCanvas = () => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  const handleMouseDown = (e) => {
    setIsDrawing(true);
    const rect = canvasRef.current.getBoundingClientRect();
    canvasRef.current.prevX = e.clientX - rect.left;
    canvasRef.current.prevY = e.clientY - rect.top;
  };

  const handleMouseMove = (e) => {
    if (!isDrawing) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ctx = canvasRef.current.getContext('2d');
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(canvasRef.current.prevX, canvasRef.current.prevY);
    ctx.lineTo(x, y);
    ctx.stroke();
    socket.emit('draw', {
      from: { x: canvasRef.current.prevX, y: canvasRef.current.prevY },
      to: { x, y },
      color
    });
    canvasRef.current.prevX = x;
    canvasRef.current.prevY = y;
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const handleChat = (e) => {
    e.preventDefault();
    if (message.trim()) {
      socket.emit('chat message', `[${username}] ${message}`);
      setMessage('');
    }
  };

  return !loggedIn ? (
    <div>
      <h2>請輸入暱稱：</h2>
      <input value={username} onChange={(e) => setUsername(e.target.value)} />
      <button onClick={() => setLoggedIn(true)}>進入聊天室</button>
    </div>
  ) : (
    <div style={{ padding: '20px' }}>
      <div style={{ position: 'relative', width: '500px', height: '500px', margin: '0 auto' }}>
        <video ref={videoRef} autoPlay muted style={{ width: '500px', height: '500px', objectFit: 'cover', position: 'absolute', top: 0, left: 0, zIndex: 1 }} />
        <canvas
          ref={canvasRef}
          width={500}
          height={500}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{ border: '1px solid black', position: 'absolute', top: 0, left: 0, zIndex: 2 }}
        />
        <button onClick={() => socket.emit('clear')} style={{ position: 'absolute', top: 10, left: 510, zIndex: 3 }}>清空畫板</button>
      </div>

      <div style={{ marginTop: '20px' }}>
        <form onSubmit={handleChat} style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="輸入訊息"
            style={{ flex: 1 }}
          />
          <button type="submit">送出</button>
        </form>
        <div ref={chatRef} style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #ccc', padding: '5px' }}>
          {messages.map((msg, idx) => <div key={idx}>{msg}</div>)}
        </div>
      </div>
    </div>
  );
}

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);
