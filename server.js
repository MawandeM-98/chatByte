const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// Track users per room: { roomName: { socketId: username } }
const rooms = {};

io.on('connection', (socket) => {
  console.log(`✅ User connected: ${socket.id}`);

  // Join a room
  socket.on('joinRoom', ({ username, room }) => {
    socket.join(room);

    // Save user
    if (!rooms[room]) rooms[room] = {};
    rooms[room][socket.id] = username;

    // Tell everyone in the room
    io.to(room).emit('message', {
      user: 'System',
      text: `${username} joined the room`,
      time: new Date().toLocaleTimeString(),
      system: true,
    });

    // Send updated user list
    io.to(room).emit('userList', Object.values(rooms[room]));

    // Store on socket for later
    socket.username = username;
    socket.room = room;
  });

  // Chat message
  socket.on('chatMessage', ({ text }) => {
    if (!socket.room) return;
    io.to(socket.room).emit('message', {
      user: socket.username,
      text,
      time: new Date().toLocaleTimeString(),
    });
  });

  // Typing indicator
  socket.on('typing', (isTyping) => {
    if (!socket.room) return;
    socket.to(socket.room).emit('userTyping', {
      username: socket.username,
      isTyping,
    });
  });

  // Disconnect
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

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});