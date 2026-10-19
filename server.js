require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- Database Setup ---
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Message Schema
const messageSchema = new mongoose.Schema({
  room: String,
  user: String,
  text: String,
  time: String,
  system: Boolean,
  createdAt: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);

// --- Express Setup ---
app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

io.on('connection', (socket) => {
  console.log(`✅ User connected: ${socket.id}`);

  // Join a room
  socket.on('joinRoom', async ({ username, room }) => {
    socket.join(room);

    if (!rooms[room]) rooms[room] = {};
    rooms[room][socket.id] = username;

    // 1. Fetch last 50 messages from DB
    try {
      const history = await Message.find({ room })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
      
      // Send history to the newly joined user (reverse so oldest is at top)
      socket.emit('history', history.reverse());
    } catch (err) {
      console.error('Error fetching history:', err);
    }

    // 2. Create system message
    const sysMsg = new Message({
      room,
      user: 'System',
      text: `${username} joined the room`,
      time: new Date().toLocaleTimeString(),
      system: true
    });
    
    // Save to DB and broadcast
    await sysMsg.save();

    io.to(room).emit('message', {
      user: sysMsg.user,
      text: sysMsg.text,
      time: sysMsg.time,
      system: sysMsg.system
    });

    io.to(room).emit('userList', Object.values(rooms[room]));

    socket.username = username;
    socket.room = room;
  });

  // Chat message
  socket.on('chatMessage', async ({ text }) => {
    if (!socket.room) return;

    const msg = new Message({
      room: socket.room,
      user: socket.username,
      text,
      time: new Date().toLocaleTimeString(),
      system: false
    });

    // Save to DB and broadcast
    await msg.save();

    io.to(socket.room).emit('message', {
      user: msg.user,
      text: msg.text,
      time: msg.time,
      system: msg.system
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
  socket.on('disconnect', async () => {
    const { room, username } = socket;
    if (room && rooms[room]) {
      delete rooms[room][socket.id];

      const sysMsg = new Message({
        room,
        user: 'System',
        text: `${username} left the room`,
        time: new Date().toLocaleTimeString(),
        system: true
      });

      await sysMsg.save();

      io.to(room).emit('message', {
        user: sysMsg.user,
        text: sysMsg.text,
        time: sysMsg.time,
        system: sysMsg.system
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