import express from "express";
import { createServer } from "node:http";
import "dotenv/config";
import { Server } from "socket.io";
import pg from "pg";

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// PostgreSQL connection
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

await pool.query(`
  CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      content TEXT,
      username TEXT,
      room TEXT,
      created_at TIMESTAMP DEFAULT NOW()
  );
`);

// In-memory tracking of connected users (TICKET-3)
const roomUsers = new Map();        // room -> Set { username1, username2, ... }
const socketToUser = new Map();     // socket.id -> { username, room }

app.get("/", (req, res) => {
  res.send("<h1>Hello world</h1>");
});

// For ticket 1
io.on("connection", async (socket) => {
  console.log("a user connected", socket.id);

  // for user to join a room
  socket.on("join room", async ({ username, room }) => {
    socket.join(room);
    socket.data.username = username;
    socket.data.room = room;

    // Add user to tracking maps (TICKET-3)
    if (!roomUsers.has(room)) {
      roomUsers.set(room, new Set());
    }
    roomUsers.get(room).add(username);
    socketToUser.set(socket.id, { username, room });

    console.log(`[JOIN] ${username} joined room "${room}". Connected users: ${Array.from(roomUsers.get(room)).join(", ")}`);

    // Fetch history and send to the joining client
    try {
      const result = await pool.query(
        "SELECT id, content, username, created_at FROM messages WHERE room = $1 ORDER BY id",
        [room]
      );
      socket.emit("room history", result.rows);

      // Send current connected users to the joining client (full list for UI init)
      const connectedUsers = Array.from(roomUsers.get(room));
      socket.emit("room users", { room, users: connectedUsers });

      // Notify others in the room that a user joined (delta update)
      socket.to(room).emit("user joined", { username, room });
    } catch (e) {
      console.error("Error fetching history or sending room users:", e);
    }
  });

  // for leaving room sends message to other users in the room youve left and stops recieving messages from that room
  socket.on("leave room", ({ room }) => {
    const username = socket.data.username;
    socket.leave(room);

    // Remove user from tracking maps (TICKET-3)
    if (roomUsers.has(room)) {
      roomUsers.get(room).delete(username);
      if (roomUsers.get(room).size === 0) {
        roomUsers.delete(room);
      }
    }

    console.log(`[LEAVE] ${username} left room "${room}". Connected users: ${roomUsers.has(room) ? Array.from(roomUsers.get(room)).join(", ") : "(empty)"}`);

    io.to(room).emit("user left", { username, room });
  });

  // to send messsage but now isntad of sending to everyone we send to only the room that the user is in and also we save the message to database
  socket.on("chat message", async ({ content, username, room }) => {
    try {
      const result = await pool.query(
        "INSERT INTO messages (content, username, room) VALUES ($1, $2, $3) RETURNING *",
        [content, username, room]
      );
      io.to(room).emit("chat message", result.rows[0]);
    } catch (e) {
      console.error("Error inserting message:", e);
    }
  });

  // TICKET-5: Typing indicator - notify others when user is typing
  socket.on("typing", ({ username, room }) => {
    // Send to all users in the room EXCEPT the one typing
    socket.to(room).emit("user typing", { username, room });
    console.log(`[TYPING] ${username} is typing in "${room}"`);
  });

  // TICKET-5: Typing indicator - notify others when user stops typing
  socket.on("stop typing", ({ username, room }) => {
    // Send to all users in the room
    socket.to(room).emit("stop typing", { username, room });
    console.log(`[STOP TYPING] ${username} stopped typing in "${room}"`);
  });

  socket.on("disconnect", () => {
    // Auto-cleanup when user disconnects without explicit 'leave room' (TICKET-3)
    const userInfo = socketToUser.get(socket.id);
    if (userInfo) {
      const { username, room } = userInfo;

      // Remove user from room tracking
      if (roomUsers.has(room)) {
        roomUsers.get(room).delete(username);
        if (roomUsers.get(room).size === 0) {
          roomUsers.delete(room);
        }
      }

      console.log(`[DISCONNECT] ${username} disconnected from room "${room}". Connected users: ${roomUsers.has(room) ? Array.from(roomUsers.get(room)).join(", ") : "(empty)"}`);

      // Notify others that this user left
      io.to(room).emit("user left", { username, room });
    }

    // Clean up socket mapping
    socketToUser.delete(socket.id);
    console.log("User disconnected", socket.id);
  });
});

// prep for deployment
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`server running on port ${PORT}`);
});
