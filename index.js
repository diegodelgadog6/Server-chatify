import express from 'express';
import { disconnect } from 'node:cluster';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { open } from 'sqlite';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// PostgreSQL connection
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

await pool.query(`
  CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      client_offset TEXT UNIQUE,
      content TEXT
  );
`);

app.get('/', (req, res) => {
  res.send('<h1>Hello world</h1>');
});

io.on('connection', async (socket) => {
  console.log('a user connected', socket.id);

  if (!socket.recovered) {
    // if the connection state recovery was not successful
    try {
      const result = await pool.query('SELECT id, content FROM messages WHERE id > $1', [socket.handshake.auth.serverOffset || 0]);
      result.rows.forEach((row) => {
        socket.emit('chat message', row.content, row.id);
      });
    } catch (e) {
      // something went wrong
    }
  }

  socket.on('chat message', async (msg) => {
    console.log('message: ' + msg);

    let result;
    try {
      // store the message in the database
      result = await db.run('INSERT INTO messages (content) VALUES (?)', msg);
    } catch (e) {
      // TODO handle the failure
      return;
    }
    // include the offset with the message
    io.emit('chat message', msg, result.lastID);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected', socket.id);
  });

  connectionStateRecovery: {
  }
}); 

server.listen(3000, () => {
  console.log('server running at http://localhost:3000');
});