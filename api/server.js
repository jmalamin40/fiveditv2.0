const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  path: '/api/socket.io',
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  namespace: 'api'
});

const PORT = process.env.PORT || 3004;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/services', require('./routes/services'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/codecanyon', require('./routes/codecanyon'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/admin/categories', require('./routes/adminCategories'));
app.use('/api/admin/services', require('./routes/adminServices'));
app.use('/api/admin/codecanyon', require('./routes/adminScripts'));
app.use('/api/admin', require('./routes/adminProfile'));

// Setup Socket.IO handlers
const { setupSocketHandlers } = require('./socket/socketHandler');
setupSocketHandlers(io);

// Serve uploaded files publicly
// Files are stored in root/uploads, so we need to go up one level from api/
const uploadsPath = path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsPath, {
  setHeaders: (res, filePath) => {
    // Set CORS headers for images
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    // Cache images for 1 year
    if (filePath.endsWith('.png') || filePath.endsWith('.jpg') || filePath.endsWith('.jpeg') || filePath.endsWith('.gif') || filePath.endsWith('.webp')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    }
  }
}));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'FivedIT API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 FivedIT API Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔌 Socket.IO server ready at path: ${io._opts.path}`);
  console.log(`   Full Socket.IO URL: http://localhost:${PORT}${io._opts.path}`);
});

module.exports = { app, server, io };

