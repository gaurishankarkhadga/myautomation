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

const youtubeRoutes = require('./route/youtubeapi');
app.use('/api/youtube', youtubeRoutes);

const chatRoutes = require('./route/chatapi');
app.use('/api/chat', chatRoutes);

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

// ==================== CRON JOBS ====================
const cron = require('node-cron');
const { WebhookEvent, Token } = require('./model/Instaautomation');
const axios = require('axios');

cron.schedule('*/5 * * * *', async () => {
  console.log('[Cron] Checking for scheduled viral tag replies...');
  try {
    const pendingEvents = await WebhookEvent.find({
      eventType: 'viral_tag_scheduled_reply',
      processed: false,
      scheduledAt: { $lte: new Date() }
    });

    if (pendingEvents.length === 0) return;

    console.log(`[Cron] Found ${pendingEvents.length} pending viral tag replies.`);

    for (const event of pendingEvents) {
      try {
        const tokenData = await Token.findOne({ userId: event.userId });
        if (!tokenData) {
          console.error(`[Cron] No token for user ${event.userId}`);
          event.processed = true;
          await event.save();
          continue;
        }

        // Send the comment
        const { mediaId, message } = event.payload;
        await axios.post(
          `https://graph.instagram.com/v24.0/${mediaId}/comments`,
          { message },
          {
            params: { access_token: tokenData.accessToken }
          }
        );

        console.log(`[Cron] Successfully posted viral tag reply to media ${mediaId}`);
        event.processed = true;
        await event.save();
      } catch (err) {
        console.error(`[Cron] Error processing event ${event._id}:`, err.response?.data || err.message);
        // Mark as processed anyway so we don't infinitely retry failed ones immediately
        event.processed = true;
        await event.save();
      }
    }
  } catch (err) {
    console.error('[Cron] Job error:', err.message);
  }
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
