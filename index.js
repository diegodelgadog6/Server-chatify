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

    // afte user joins room we fetch the history and send it back to user
    try {
      const result = await pool.query(
        "SELECT id, content, username, created_at FROM messages WHERE room = $1 ORDER BY id",
        [room]
      );
      socket.emit("room history", result.rows);
    } catch (e) {
      console.error("Error fetching history:", e);
    }

    // notifies others when joining
    io.to(room).emit("user joined", { username, room });
  });

  // for leaving room sends message to other users in the room youve left and stops recieving messages from that room
  socket.on("leave room", ({ room }) => {
    socket.leave(room);
    io.to(room).emit("user left", { username: socket.data.username, room });
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

  socket.on("disconnect", () => {
    console.log("User disconnected", socket.id);
  });
});

// prep for deployment
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`server running on port ${PORT}`);
});
