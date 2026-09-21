const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

const publicPath = path.join(__dirname, "public");

app.use(express.json());
app.use(express.static(publicPath));

app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "MovieRoom",
    time: new Date().toISOString()
  });
});

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

function getCurrentPosition(room) {
  let position = room.position;

  if (room.playing) {
    position += (Date.now() - room.updatedAt) / 1000;
  }

  return position;
}

io.on("connection", socket => {

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

    if (movie && !room.movie) {
      room.movie = movie;
    }

    socket.emit("room-state", {
      movie: room.movie,
      playing: room.playing,
      position: getCurrentPosition(room),
      users: getUsers(room)
    });

    io.to(roomId).emit(
      "users-updated",
      getUsers(room)
    );

    io.to(roomId).emit(
      "system-message",
      `${name} შემოვიდა ოთახში 👋`
    );
  });

  socket.on("set-movie", movie => {

    const roomId = socket.data.roomId;

    if (!roomId) return;

    const room = getRoom(roomId);

    room.movie = movie || null;
    room.position = 0;
    room.playing = false;
    room.updatedAt = Date.now();

    io.to(roomId).emit(
      "movie-changed",
      room.movie
    );

    io.to(roomId).emit("video-state", {
      playing: false,
      position: 0
    });
  });

  socket.on("play", position => {

    const roomId = socket.data.roomId;

    if (!roomId) return;

    const room = getRoom(roomId);

    room.position =
      Number.isFinite(Number(position))
        ? Number(position)
        : getCurrentPosition(room);

    room.playing = true;
    room.updatedAt = Date.now();

    io.to(roomId).emit("video-play", {
      position: room.position
    });
  });

  socket.on("pause", position => {

    const roomId = socket.data.roomId;

    if (!roomId) return;

    const room = getRoom(roomId);

    room.position =
      Number.isFinite(Number(position))
        ? Number(position)
        : getCurrentPosition(room);

    room.playing = false;
    room.updatedAt = Date.now();

    io.to(roomId).emit("video-pause", {
      position: room.position
    });
  });

  socket.on("seek", position => {

    const roomId = socket.data.roomId;

    if (!roomId) return;

    const room = getRoom(roomId);

    room.position = Number(position) || 0;
    room.updatedAt = Date.now();

    io.to(roomId).emit("video-seek", {
      position: room.position
    });
  });

  socket.on("chat-message", message => {

    const roomId = socket.data.roomId;

    if (!roomId) return;

    const name = socket.data.name || "სტუმარი";

    message = String(message || "")
      .trim()
      .slice(0, 500);

    if (!message) return;

    io.to(roomId).emit("chat-message", {
      name,
      message,
      time: new Date().toISOString()
    });
  });

  socket.on("disconnect", () => {

    const roomId = socket.data.roomId;

    if (!roomId) return;

    const room = rooms.get(roomId);

    if (!room) return;

    const name = socket.data.name || "სტუმარი";

    room.users.delete(socket.id);

    io.to(roomId).emit(
      "users-updated",
      getUsers(room)
    );

    io.to(roomId).emit(
      "system-message",
      `${name} გავიდა ოთახიდან 👋`
    );

    if (room.users.size === 0) {
      rooms.delete(roomId);
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`MovieRoom running on ${HOST}:${PORT}`);
});
