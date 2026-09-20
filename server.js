const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

// public საქაღალდის სწორად მითითება
const publicPath = path.join(__dirname, "public");

app.use(express.static(publicPath));

// მთავარი გვერდი
app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "MovieRoom",
    time: new Date().toISOString()
  });
});

// ოთახების მონაცემები
const rooms = new Map();

function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      movie: null,
      playing: false,
      position: 0,
      updatedAt: Date.now(),
      users: new Map()
    });
  }

  return rooms.get(roomId);
}

function getUsers(room) {
  return [...room.users.values()].map(user => ({
    id: user.id,
    name: user.name
  }));
}

// Socket.IO
io.on("connection", socket => {

  // ოთახში შესვლა
  socket.on("join-room", ({ roomId, name, movie }) => {

    roomId = String(roomId || "")
      .trim()
      .toUpperCase()
      .slice(0, 32);

    name = String(name || "სტუმარი")
      .trim()
      .slice(0, 24) || "სტუმარი";

    if (!roomId) return;

    const room = getRoom(roomId);

    socket.join(roomId);

    socket.data.roomId = roomId;
    socket.data.name = name;

    room.users.set(socket.id, {
      id: socket.id,
      name
    });

    // თუ ოთახს ფილმი ჯერ არ აქვს
    if (movie && !room.movie) {
      room.movie = movie;
    }

    let currentPosition = room.position;

    if (room.playing) {
      currentPosition +=
        (Date.now() - room.updatedAt) / 1000;
    }

    socket.emit("room-state", {
      movie: room.movie,
      playing: room.playing,
      position: currentPosition,
      users: getUsers(room)
    });

    socket.to(roomId).emit(
      "users-updated",
      getUsers(room)
    );

    io.to(roomId).emit(
      "system-message",
      `${name} შემოვიდა ოთახში 👋`
    );
  });

  // ფილმის შეცვლა
  socket.on("set-movie", movie => {

    const roomId = socket.data.roomId;

    if (!roomId) return;

    const room = getRoom(roomId);

    room.movie = movie;
    room.position = 0;
    room.playing = false;
    room.updatedAt = Date.now();

    io.to(roomId).emit(
      "movie-changed",
      movie
    );
  });

  // ვიდეო
