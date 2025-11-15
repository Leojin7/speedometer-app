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

// Database connection configuration
let pool;
const useDatabase = process.env.DATABASE_URL || (process.env.DB_HOST && process.env.DB_NAME);

if (useDatabase) {
  if (process.env.DATABASE_URL) {
    // Use connection string (for NeonDB)
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false // For self-signed certificates
      }
    });
  } else {
    // Use individual parameters
    pool = new Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'speedometer',
      password: process.env.DB_PASSWORD || 'postgres',
      port: parseInt(process.env.DB_PORT || '5432'),
    });
  }

  // Test database connection
  pool.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.error('Database connection error', err.message);
      console.log('Continuing without database - using in-memory storage only');
      pool = null;
      startSpeedSimulation();
    } else {
      console.log('Database connected successfully');
      initializeDatabase();
    }
  });
} else {
  console.log('No database configuration found - using in-memory storage only');
  startSpeedSimulation();
}

// Configure CORS with allowed origins and WebSocket support
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5000',
  'https://speedometer-app-frontend.vercel.app',
  'https://speedometer-app-backend.vercel.app',
  'https://speedometer-ofhtk9vu2-dev-ruhelas-projects-f398715f.vercel.app',
  'wss://speedometer-app-backend.vercel.app',
  'https://speedometer-app.vercel.app',
  'wss://speedometer-app.vercel.app',
  /^\.*\.vercel\.app$/,  // Allow all Vercel preview deployments
  /^https?:\/\/localhost(:\d+)?$/  // Allow localhost with any port
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Check if the origin matches any of the allowed patterns
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return origin === allowed;
      } else if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return false;
    });

    if (!isAllowed) {
      const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
      console.warn(msg);
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'OPTIONS', 'UPGRADE'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'Upgrade'],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors());

app.use(express.json());

// WebSocket server with CORS support
let wss;

if (isVercel) {
  // Vercel serverless function handling
  wss = new WebSocket.Server({ noServer: true });

  // Handle WebSocket upgrade requests
  server.on('upgrade', (request, socket, head) => {
    const origin = request.headers.origin;

    // Check if origin is allowed
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return origin === allowed;
      } else if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return false;
    });

    if (!isAllowed) {
      console.log('WebSocket connection rejected from origin:', origin);
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });
} else {
  // Local development with WebSocket.Server
  wss = new WebSocket.Server({
    server,
    path: '/ws',
    clientTracking: true,
    verifyClient: (info, done) => {
      const origin = info.origin || info.req.headers.origin;
      if (!origin || allowedOrigins.some(allowed => {
        if (typeof allowed === 'string') {
          return origin === allowed;
        } else if (allowed instanceof RegExp) {
          return allowed.test(origin);
        }
        return false;
      })) {
        return done(true);
      }
      console.log('WebSocket connection rejected from origin:', origin);
      return done(false, 401, 'Unauthorized');
    }
  });
}

// Ping interval to keep connections alive
const PING_INTERVAL = 30000;

wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection');
  clients.add(ws);

  // Send current speed immediately
  getLatestSpeed().then(speed => {
    ws.send(JSON.stringify({
      type: 'SPEED_UPDATE',
      data: { speed: parseFloat(speed.toFixed(1)) },
      timestamp: new Date().toISOString()
    }));
  });

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received message:', data);

      // Handle different message types
      if (data.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG' }));
      } else if (data.type === 'GET_HISTORY') {
        // Get historical data for chart
        try {
          const result = await pool.query(
            'SELECT * FROM speed_data ORDER BY timestamp DESC LIMIT 100'
          );
          ws.send(JSON.stringify({
            type: 'HISTORY_DATA',
            data: result.rows
          }));
        } catch (error) {
          console.error('Error fetching history:', error);
        }
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

// Start server
if (isVercel) {
  module.exports = app;
} else {
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// For Vercel serverless functions
module.exports = app;

// Handle process termination
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  clearInterval(speedInterval);
  wss.close(() => {
    console.log('WebSocket server closed');
    pool.end(() => {
      console.log('Database connection pool closed');
      process.exit(0);
    });
  });
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit in production, let the process manager handle it
  if (process.env.NODE_ENV !== 'production') process.exit(1);
});

// Initialize database
const initializeDatabase = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS speed_data (
        id SERIAL PRIMARY KEY,
        speed FLOAT NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Database initialized');

    // Start speed simulation after database is ready
    startSpeedSimulation();
  } catch (error) {
    console.error('Error initializing database:', error);
  }
};

// Speed simulation
let speedInterval;
let clients = new Set();

// Store speed in database
const storeSpeed = async (speed) => {
  try {
    await pool.query(
      'INSERT INTO speed_data (speed) VALUES ($1)',
      [speed]
    );
  } catch (error) {
    console.error('Error storing speed:', error);
  }
};

// Broadcast speed to all connected clients
const broadcastSpeed = (speed) => {
  const message = JSON.stringify({
    type: 'SPEED_UPDATE',
    data: { speed: parseFloat(speed.toFixed(1)) },
    timestamp: new Date().toISOString()
  });

  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};

// Get latest speed from database
const getLatestSpeed = async () => {
  try {
    const result = await pool.query(
      'SELECT speed FROM speed_data ORDER BY timestamp DESC LIMIT 1'
    );
    return result.rows[0]?.speed || 0;
  } catch (error) {
    console.error('Error getting latest speed:', error);
    return 0;
  }
};

const startSpeedSimulation = () => {
  // Clear existing interval if any
  if (speedInterval) clearInterval(speedInterval);

  let currentSpeed = 0;
  let increasing = true;

  // Initialize with latest speed from database
  getLatestSpeed().then(speed => {
    currentSpeed = speed || 0;
    console.log(`Starting simulation with speed: ${currentSpeed}`);
  });

  speedInterval = setInterval(async () => {
    // Simulate speed changes
    if (increasing) {
      currentSpeed += Math.random() * 5;
      if (currentSpeed >= 120) increasing = false;
    } else {
      currentSpeed -= Math.random() * 5;
      if (currentSpeed <= 0) increasing = true;
    }

    // Ensure speed stays within bounds
    currentSpeed = Math.max(0, Math.min(120, currentSpeed));

    // Store in database
    await storeSpeed(currentSpeed);

    // Broadcast to all connected clients
    broadcastSpeed(currentSpeed);

    // Also store in speed_measurements table for history
    pool.query(
      'INSERT INTO speed_measurements (speed) VALUES ($1)',
      [currentSpeed],
      (error) => {
        if (error) console.error('Error saving speed to measurements:', error);
      }
    );
  }, 1000);
}