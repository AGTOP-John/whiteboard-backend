// ✅ 完整後端 WebRTC signaling + 聊天 + 畫板同步 + 角色管理
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.static(path.join(__dirname, 'dist')));

let broadcasterId = null;

io.on('connection', (socket) => {
  console.log('使用者已連線:', socket.id);

  // 分配角色
  if (!broadcasterId) {
    broadcasterId = socket.id;
    socket.emit('role', 'broadcaster');
  } else {
    socket.emit('role', 'viewer');
    if (broadcasterId) {
      io.to(broadcasterId).emit('new viewer', socket.id);
    }
  }

  // WebRTC signaling
  socket.on('offer', ({ targetId, sdp }) => {
    io.to(targetId).emit('offer', { sdp, senderId: socket.id });
  });

  socket.on('answer', ({ targetId, sdp }) => {
    io.to(targetId).emit('answer', { sdp, senderId: socket.id });
  });

  socket.on('ice-candidate', ({ targetId, candidate }) => {
    io.to(targetId).emit('ice-candidate', { candidate, senderId: socket.id });
  });

  // 聊天功能
  socket.on('chat message', (msg) => {
    io.emit('chat message', msg);
  });

  // 畫板功能
  socket.on('draw', (data) => {
    socket.broadcast.emit('draw', data);
  });

  socket.on('clear', () => {
    io.emit('clear');
  });

  // 離線處理
  socket.on('disconnect', () => {
    if (socket.id === broadcasterId) {
      broadcasterId = null;
    }
    console.log('使用者離線:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`伺服器啟動於 http://localhost:${PORT}`);
});
