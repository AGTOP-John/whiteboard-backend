const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

app.use(cors());
app.get('/', (req, res) => {
  res.send('✅ Server is running');
});

// === WebSocket Core ===
let broadcasterId = null;

io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);

  // 分配 WebRTC 角色
  if (!broadcasterId) {
    broadcasterId = socket.id;
    socket.emit('role', 'broadcaster');
    console.log(`🎥 ${socket.id} assigned as broadcaster`);
  } else {
    socket.emit('role', 'viewer');
    socket.to(broadcasterId).emit('viewer-joined', socket.id);
    console.log(`👀 ${socket.id} joined as viewer`);
  }

  // --- WebRTC signaling ---
  socket.on('signal', ({ target, data }) => {
    io.to(target).emit('signal', {
      source: socket.id,
      data,
    });
  });

  // --- 畫板同步繪圖 ---
  socket.on('drawing', (data) => {
    socket.broadcast.emit('drawing', data);
  });

  // --- 聊天訊息 ---
  socket.on('chat message', (msg) => {
    io.emit('chat message', msg);
  });

  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
    if (socket.id === broadcasterId) {
      broadcasterId = null;
      console.log('🎥 Broadcaster left, broadcasterId reset');
    }
  });
});

server.listen(3001, () => {
  console.log('🚀 Server listening on port 3001');
});