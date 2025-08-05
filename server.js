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

let broadcasterId = null;
let users = {}; // key: socket.id, value: { username, role }

io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);

  // 分配角色
  if (!broadcasterId) {
    broadcasterId = socket.id;
    socket.emit('role', 'broadcaster');
    console.log(`🎥 ${socket.id} assigned as broadcaster`);
  } else {
    socket.emit('role', 'viewer');
    socket.to(broadcasterId).emit('viewer-joined', socket.id);
    console.log(`👀 ${socket.id} joined as viewer`);
  }

  // 接收使用者資訊
  socket.on('user-joined', ({ username, role }) => {
    users[socket.id] = { username, role };
    console.log(`✅ User joined: ${username} (${role})`);
    io.emit('user-list', Object.values(users));
  });

  // WebRTC signaling
  socket.on('signal', ({ target, data }) => {
    io.to(target).emit('signal', { source: socket.id, data });
  });

  // 畫板同步
  socket.on('drawing', (data) => {
    socket.broadcast.emit('drawing', data);
  });

  // 離線處理
  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
    if (socket.id === broadcasterId) {
      broadcasterId = null;
      console.log('⚠️ Broadcaster left, clearing broadcasterId');
    }
    delete users[socket.id];
    io.emit('user-list', Object.values(users));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});