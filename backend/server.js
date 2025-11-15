// server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const isVercel = process.env.VERCEL === '1';
const server = isVercel ? http.createServer() : http.createServer(app);

// Configure CORS with allowed origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5000',
  'https://speedometer-app-frontend.vercel.app',
  'https://speedometer-app-backend.vercel.app',
  'https://speedometer-guhijxs04-dev-ruhelas-projects-f398715f.vercel.app',
  'wss://speedometer-app-backend.vercel.app',
  'https://speedometer-app.vercel.app',
  'wss://speedometer-app.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight requests
app.options('*', cors());

app.use(express.json());

// WebSocket server with CORS support
const wss = new WebSocket.Server(
  isVercel
    ? { server }
    : {
      server,
      path: '/ws',
      clientTracking: true,
      verifyClient: (info, done) => {
        const origin = info.origin || info.req.headers.origin;
        if (!origin || allowedOrigins.some(allowed => origin.startsWith(allowed.replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '')))) {
          return done(true);
        }
        console.log('WebSocket connection rejected from origin:', origin);
        return done(false, 401, 'Unauthorized');
      }
    }
);

// Ping interval to keep connections alive
const PING_INTERVAL = 30000; // 30 seconds

wss.on('connection', (ws, req) => {
  console.log('New WebSocket client connected');
  const clientIp = req.socket.remoteAddress;
  console.log('Client IP:', clientIp);

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'SYSTEM',
    message: 'Connected to speedometer server',
    timestamp: new Date().toISOString()
  }));

  // Set up ping/pong
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  }, PING_INTERVAL);

  ws.on('pong', () => {
    console.log('Received pong from client');
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    clearInterval(pingInterval);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clearInterval(pingInterval);
  });
});

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Routes
app.post('/api/speed', async (req, res) => {
  try {
    const { speed } = req.body;

    if (typeof speed !== 'number' || speed < 0) {
      return res.status(400).json({ error: 'Invalid speed value' });
    }

    const result = await pool.query(
      'INSERT INTO speed_measurements (speed) VALUES ($1) RETURNING *',
      [speed]
    );

    // Broadcast to all connected WebSocket clients
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'SPEED_UPDATE',
          data: result.rows[0],
          timestamp: new Date().toISOString()
        }));
      }
    });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error saving speed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
if (isVercel) {
  module.exports = app;
} else {
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`WebSocket server running on ws://localhost:${PORT}/ws`);
    initializeDatabase();
    startSpeedSimulation();
  });
}

// Initialize database
async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS speed_measurements (
        id SERIAL PRIMARY KEY,
        speed FLOAT NOT NULL,
        recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Database initialized');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

// Speed simulation
let speedInterval;
function startSpeedSimulation() {
  if (speedInterval) clearInterval(speedInterval);

  speedInterval = setInterval(() => {
    const speed = Math.floor(Math.random() * 120);
    const data = {
      type: 'SPEED_UPDATE',
      data: { speed },
      timestamp: new Date().toISOString()
    };

    // Broadcast to all connected clients
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });

    // Save to database
    pool.query(
      'INSERT INTO speed_measurements (speed) VALUES ($1)',
      [speed],
      (error) => {
        if (error) console.error('Error saving speed to database:', error);
      }
    );
  }, 1000);
}