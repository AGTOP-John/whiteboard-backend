import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import SimplePeer from 'simple-peer';

const socket = io("https://whiteboard-backend-1n0p.onrender.com");

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isBroadcaster, setIsBroadcaster] = useState(false);
  const [peers, setPeers] = useState({});
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('');

  useEffect(() => {
    socket.on('role', async (r) => {
      setRole(r);
      if (r === 'broadcaster') {
        setIsBroadcaster(true);
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        videoRef.current.srcObject = stream;
        socket.on('viewer-joined', (viewerId) => {
          const peer = new SimplePeer({ initiator: true, trickle: false, stream });
          peer.on('signal', data => socket.emit('signal', { target: viewerId, data }));
          setPeers(prev => ({ ...prev, [viewerId]: peer }));
        });
      } else {
        setIsBroadcaster(false);
      }

      // 將 username + role 同步給 server
      socket.emit('user-joined', { username, role: r });
    });

    socket.on('signal', ({ source, data }) => {
      if (!peers[source]) {
        const peer = new SimplePeer({ initiator: false, trickle: false });
        peer.on('signal', d => socket.emit('signal', { target: source, data: d }));
        peer.on('stream', stream => {
          videoRef.current.srcObject = stream;
        });
        peer.signal(data);
        setPeers(prev => ({ ...prev, [source]: peer }));
      } else {
        peers[source].signal(data);
      }
    });

    return () => {
      socket.disconnect();
      Object.values(peers).forEach(p => p.destroy());
    };
  }, [username]);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const resizeCanvas = () => {
      const temp = document.createElement('canvas');
      temp.width = canvas.width;
      temp.height = canvas.height;
      temp.getContext('2d').drawImage(canvas, 0, 0);

      canvas.width = video.clientWidth;
      canvas.height = video.clientHeight;
      canvas.getContext('2d').drawImage(temp, 0, 0);
    };

    video.addEventListener('loadedmetadata', resizeCanvas);
    window.addEventListener('resize', resizeCanvas);
    return () => {
      video.removeEventListener('loadedmetadata', resizeCanvas);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let drawing = false;

    const start = (e) => {
      drawing = true;
      draw(e);
    };
    const end = () => { drawing = false; ctx.beginPath(); };
    const draw = (e) => {
      if (!drawing) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'red';
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
      socket.emit('drawing', { x, y });
    };

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('touchstart', (e) => start(e.touches[0]));
    canvas.addEventListener('touchend', end);
    canvas.addEventListener('touchmove', (e) => draw(e.touches[0]));

    socket.on('drawing', ({ x, y }) => {
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'red';
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
    });

    return () => {
      canvas.removeEventListener('mousedown', start);
      canvas.removeEventListener('mouseup', end);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('touchstart', (e) => start(e.touches[0]));
      canvas.removeEventListener('touchend', end);
      canvas.removeEventListener('touchmove', (e) => draw(e.touches[0]));
    };
  }, []);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div style={{ position: 'relative', textAlign: 'center' }}>
      <div style={{ padding: '0.5em', background: '#eee' }}>
        <span>👤 你的暱稱：</span>
        <input value={username} onChange={(e) => setUsername(e.target.value)} />
        <span style={{ marginLeft: '1em' }}>🧑‍💻 角色：{role}</span>
        <button style={{ marginLeft: '1em' }} onClick={clearCanvas}>🧹 清除畫布</button>
      </div>
      <div style={{ position: 'relative' }}>
        <video ref={videoRef} autoPlay playsInline muted={isBroadcaster} style={{ width: '100%' }} />
        <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0 }} />
      </div>
    </div>
  );
}

export default App;