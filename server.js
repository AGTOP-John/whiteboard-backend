// server_webrtc_full.js 內容（整合 WebRTC signaling + 聊天 + 畫板 + 使用者管理）
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

let broadcasterId = null;

io.on('connection', socket => {
  console.log('User connected:', socket.id);

  socket.on('set-username', username => {
    socket.data.username = username;
    if (!broadcasterId) {
      broadcasterId = socket.id;
      socket.emit('role', 'broadcaster');
    } else {
      socket.emit('role', 'viewer');
      io.to(broadcasterId).emit('new-viewer', socket.id);
    }
  });

  socket.on('signal', ({ targetId, data }) => {
    io.to(targetId).emit('signal', { senderId: socket.id, data });
  });

  socket.on('chat-message', msg => {
    io.emit('chat-message', { user: socket.data.username || '匿名', message: msg });
  });

  socket.on('drawing', data => {
    socket.broadcast.emit('drawing', data);
  });

  socket.on('clear-canvas', () => {
    socket.broadcast.emit('clear-canvas');
  });

  socket.on('disconnect', () => {
    if (socket.id === broadcasterId) {
      broadcasterId = null;
    }
    io.emit('user-disconnected', socket.id);
  });
});

server.listen(3000, () => {
  console.log('Server is running on port 3000');
});