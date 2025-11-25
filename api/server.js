const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/services', require('./routes/services'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/codecanyon', require('./routes/codecanyon'));
app.use('/api/admin/categories', require('./routes/adminCategories'));
app.use('/api/admin/services', require('./routes/adminServices'));
app.use('/api/admin/codecanyon', require('./routes/adminScripts'));

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
app.listen(PORT, () => {
  console.log(`🚀 FivedIT API Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;

