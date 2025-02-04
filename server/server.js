// server.js (Node.js)
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { // Important for local development! Adjust for production
    origin: "http://127.0.0.1:4000", // Or your GitHub Pages URL
    methods: ["GET", "POST"]
  }
});

const rooms = {}; // Store game state for each room

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('createRoom', vars => {
    roomName = vars[0]
    rooms[roomName] = { players: [], location: null, options: vars[1] }; // Initialize room
    socket.join(roomName); // Join the socket to the room
  });

  socket.on('joinRoom', (roomName) => {
      if (rooms[roomName] && rooms[roomName].players.length < 2) { // Limit to 2 players for simplicity
          rooms[roomName].players.push(socket.id)
          socket.join(roomName)
          socket.emit('roomOptionsUpdate', rooms[roomName].options)
          io.to(roomName).emit('playerJoined', rooms[roomName].players) // Notify all players in the room
      } else {
          socket.emit('CantJoin', roomName)
      }
  })

  socket.on("gameOptionsUpdate", options => {
    const roomName = options[0]
    rooms[roomName].options = options
    io.to(roomName).emit("roomOptionsUpdate", options)
  })




  socket.on('disconnect', () => {
    console.log('User disconnected');
    // Handle player leaving the room
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});