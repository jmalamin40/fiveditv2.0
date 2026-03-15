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
app.use('/api/customer/auth', require('./routes/customerAuth'));
app.use('/api/customer', require('./routes/customer'));
app.use('/api/services', require('./routes/services'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/contact', require('./routes/contact'));
const analytics = require('./routes/analytics');
app.use('/api/analytics', analytics);
app.use('/api/codecanyon', require('./routes/codecanyon'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/admin/categories', require('./routes/adminCategories'));
app.use('/api/admin/services', require('./routes/adminServices'));
app.use('/api/admin/codecanyon', require('./routes/adminScripts'));
app.use('/api/admin/hosting', require('./routes/hosting'));
const hostingPackages = require('./routes/hostingPackages');
app.use('/api/hosting/payments', require('./routes/hostingPayments'));
app.use('/api/hosting', hostingPackages.public);
app.use('/api/admin/hosting', hostingPackages.admin);
const smmConfig = require('./routes/smmConfig');
const smmPayments = require('./routes/smmPayments');
app.use('/api/smm', smmConfig);
app.use('/api/smm', smmPayments);
app.use('/api/admin/smm', smmPayments.adminRouter);
app.use('/api/admin/smm-config', smmConfig.adminRouter);
app.use('/api/admin', require('./routes/adminProfile'));
app.use('/api/admin/cloudflare-config', require('./routes/cloudflareConfig'));
const facebookConfig = require('./routes/facebookConfig');
const smtpConfig = require('./routes/smtpConfig');
app.use('/api/facebook-config', facebookConfig);
app.use('/api/admin/facebook-config', facebookConfig.adminRouter);
app.use('/api/admin/smtp-config', smtpConfig.adminRouter);
app.use('/api/admin/analytics', analytics.adminRouter);
app.use('/api/domain', require('./routes/domain'));
app.use('/api/admin/domain', require('./routes/domainAdmin'));

// Invoice routes
const invoices = require('./routes/invoices');
app.use('/api/customer/invoices', invoices.customerRouter);
app.use('/api/admin/invoices', invoices.adminRouter);

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

