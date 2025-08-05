const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    // origin: [
    //   "http://localhost:3000",
    //   "https://frolicking-sawine-1e3ceb.netlify.app"
    // ],
    // origin: "https://frolicking-sawine-1e3ceb.netlify.app", // ✅ 或指定您 Netlify 網址
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.static(path.join(__dirname, 'dist')));

io.on('connection', (socket) => {
  console.log('使用者已連線:', socket.id);

  socket.on('chat message', (msg) => {
    io.emit('chat message', msg);
  });

  socket.on('draw', (data) => {
    socket.broadcast.emit('draw', data);
  });

  socket.on('clear', () => {
    io.emit('clear');
  });

  socket.on('disconnect', () => {
    console.log('使用者離線:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`伺服器啟動於 http://localhost:${PORT}`);
});