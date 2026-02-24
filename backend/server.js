require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// ==================== CORS ====================
const allowedOrigins = [...new Set([
  'http://localhost:5173',
  process.env.FRONTEND_URL
].filter(Boolean))];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('[CORS] Blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// ==================== BODY PARSING ====================
// Raw body for webhook signature verification
app.use('/api/instagram/webhook', express.raw({ type: 'application/json' }));

// Parse JSON for all other routes
app.use((req, res, next) => {
  if (req.path === '/api/instagram/webhook' && req.method === 'POST') {
    if (Buffer.isBuffer(req.body)) {
      req.rawBody = req.body;
      req.body = JSON.parse(req.body.toString());
    }
    return next();
  }
  express.json()(req, res, next);
});

// ==================== MONGODB CONNECTION ====================
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('[MongoDB] Connected successfully');
  })
  .catch((err) => {
    console.error('[MongoDB] Connection error:', err.message);
    process.exit(1);
  });

// ==================== ROUTES ====================
const instaRoutes = require('./route/instaautomationapi');
app.use('/api/instagram', instaRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    message: 'Instagram Graph API server running',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    environment: process.env.NODE_ENV || 'development',
    webhookVerifyTokenSet: !!process.env.WEBHOOK_VERIFY_TOKEN,
    webhookUrl: `${process.env.BACKEND_URL || ('http://localhost:' + (process.env.PORT || 8000))}/api/instagram/webhook`
  });
});

// ==================== ERROR HANDLERS ====================
app.use((err, req, res, next) => {
  console.error('[Error] Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.path}`
  });
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log('\n[Server] Instagram Graph API Server');
  console.log(`[Server] Running on: http://localhost:${PORT}`);
  console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[Server] Frontend URL: ${process.env.FRONTEND_URL}`);
  console.log(`[Server] OAuth Callback: ${process.env.INSTAGRAM_REDIRECT_URI}`);
  console.log(`[Server] Webhook URL: ${process.env.BACKEND_URL || ('http://localhost:' + PORT)}/api/instagram/webhook`);
  console.log(`[Server] Webhook Verify Token: ${process.env.WEBHOOK_VERIFY_TOKEN ? '*** (set)' : 'NOT SET'}\n`);
});

module.exports = app;
