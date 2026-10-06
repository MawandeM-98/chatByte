const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// Track users per room: { roomName: { socketId: username } }
const rooms = {};

io.on('connection', (socket) => {
  console.log(`✅ User connected: ${socket.id}`);

  socket.on('joinRoom', ({ username, room }) => {
    socket.join(room);

    if (!rooms[room]) rooms[room] = {};
    rooms[room][socket.id] = username;

    io.to(room).emit('message', {
      user: 'System',
      text: `${username} joined the room`,
      time: new Date().toLocaleTimeString(),
      system: true,
    });

    io.to(room).emit('userList', Object.values(rooms[room]));

    socket.username = username;
    socket.room = room;
  });

  socket.on('chatMessage', ({ text }) => {
    if (!socket.room) return;
    io.to(socket.room).emit('message', {
      user: socket.username,
      text,
      time: new Date().toLocaleTimeString(),
    });
  });

  socket.on('typing', (isTyping) => {
    if (!socket.room) return;
    socket.to(socket.room).emit('userTyping', {
      username: socket.username,
      isTyping,
    });
  });

  socket.on('disconnect', () => {
    const { room, username } = socket;
    if (room && rooms[room]) {
      delete rooms[room][socket.id];

      io.to(room).emit('message', {
        user: 'System',
        text: `${username} left the room`,
        time: new Date().toLocaleTimeString(),
        system: true,
      });

      io.to(room).emit('userList', Object.values(rooms[room]));

      if (Object.keys(rooms[room]).length === 0) delete rooms[room];
    }
    console.log(`❌ User disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 chatByte running on port ${PORT}`);
});