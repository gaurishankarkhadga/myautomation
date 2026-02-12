require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');

const app = express();

// Middleware - Allow both local and production
const allowedOrigins = [...new Set([
  'http://localhost:5173',
  'https://mydmtestingapp.netlify.app',
  process.env.FRONTEND_URL
].filter(Boolean))];


app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
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

// Raw body capture for webhook signature verification (must be BEFORE express.json)
app.use('/api/instagram/webhook', express.raw({ type: 'application/json' }));

// Parse JSON for all other routes
app.use((req, res, next) => {
  if (req.path === '/api/instagram/webhook' && req.method === 'POST') {
    // Already parsed as raw buffer above, convert to JSON
    if (Buffer.isBuffer(req.body)) {
      req.rawBody = req.body;
      req.body = JSON.parse(req.body.toString());
    }
    return next();
  }
  express.json()(req, res, next);
});

// In-memory storage for tokens (for testing only)
const tokenStore = new Map();

// In-memory storage for Instagram messaging
const messageStore = new Map(); // userId -> array of messages
const conversationStore = new Map(); // conversationId -> conversation data
const igsidMap = new Map(); // IGSID -> userId mapping


// Instagram Graph API Configuration
const INSTAGRAM_CONFIG = {
  appId: process.env.INSTAGRAM_APP_ID,
  appSecret: process.env.INSTAGRAM_APP_SECRET,
  redirectUri: process.env.INSTAGRAM_REDIRECT_URI,
  frontendUrl: process.env.FRONTEND_URL,
  oauthBaseUrl: 'https://api.instagram.com/oauth',
  graphBaseUrl: 'https://graph.instagram.com',
  scopes: ['instagram_business_basic', 'instagram_business_manage_messages', 'instagram_business_manage_comments', 'instagram_business_content_publish']
};

// Webhook Configuration
const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'your_secure_random_token_12345';

// HMAC signature verification for webhook security
function verifyWebhookSignature(req) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature || !req.rawBody) {
    console.log('[Webhook] No signature or raw body available - skipping verification');
    return true; // Allow in dev, but log warning
  }

  const expectedSignature = 'sha256=' +
    crypto.createHmac('sha256', INSTAGRAM_CONFIG.appSecret)
      .update(req.rawBody)
      .digest('hex');

  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );

  if (!isValid) {
    console.error('[Webhook] SIGNATURE MISMATCH - possible spoofed request');
  }

  return isValid;
}

// Route: Get OAuth URL
app.get('/api/instagram/auth', (req, res) => {
  try {
    const params = new URLSearchParams({
      client_id: INSTAGRAM_CONFIG.appId,
      redirect_uri: INSTAGRAM_CONFIG.redirectUri,
      scope: INSTAGRAM_CONFIG.scopes.join(','),
      response_type: 'code'
    });

    const authUrl = `${INSTAGRAM_CONFIG.oauthBaseUrl}/authorize?${params.toString()}`;

    console.log('[OAuth] Generated authorization URL');

    res.json({
      success: true,
      authUrl,
      message: 'Redirect user to this URL to authorize'
    });
  } catch (error) {
    console.error('[OAuth] Auth URL generation error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to generate auth URL',
      message: error.message
    });
  }
});

// Route: Handle OAuth Callback
app.get('/api/instagram/callback', async (req, res) => {
  try {
    const { code, error, error_reason, error_description } = req.query;

    if (error) {
      console.error('[OAuth] Instagram OAuth error:', error_reason, error_description);
      return res.redirect(`${INSTAGRAM_CONFIG.frontendUrl}?error=${error}&reason=${error_reason}`);
    }

    if (!code) {
      return res.redirect(`${INSTAGRAM_CONFIG.frontendUrl}?error=no_code`);
    }

    console.log('[OAuth] Received authorization code');

    // Step 1: Exchange code for short-lived token
    console.log('[OAuth] Exchanging code for token');
    const tokenResponse = await axios.post(
      `${INSTAGRAM_CONFIG.oauthBaseUrl}/access_token`,
      new URLSearchParams({
        client_id: INSTAGRAM_CONFIG.appId,
        client_secret: INSTAGRAM_CONFIG.appSecret,
        grant_type: 'authorization_code',
        redirect_uri: INSTAGRAM_CONFIG.redirectUri,
        code
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    const shortLivedToken = tokenResponse.data.access_token;
    const userId = tokenResponse.data.user_id;
    console.log('[OAuth] Short-lived token received for user:', userId);

    // Step 2: Exchange for long-lived token (60 days)
    console.log('[OAuth] Getting long-lived token');
    const longLivedResponse = await axios.get(
      `${INSTAGRAM_CONFIG.graphBaseUrl}/access_token`,
      {
        params: {
          grant_type: 'ig_exchange_token',
          client_secret: INSTAGRAM_CONFIG.appSecret,
          access_token: shortLivedToken
        }
      }
    );

    const longLivedToken = longLivedResponse.data.access_token;
    const expiresIn = longLivedResponse.data.expires_in;
    console.log('[OAuth] Long-lived token received (expires in', expiresIn, 'seconds)');

    // Store token in memory
    tokenStore.set(userId, {
      accessToken: longLivedToken,
      expiresIn,
      createdAt: new Date()
    });

    // Redirect to frontend with token and userId
    res.redirect(`${INSTAGRAM_CONFIG.frontendUrl}?token=${longLivedToken}&userId=${userId}&expiresIn=${expiresIn}`);

  } catch (error) {
    console.error('[OAuth] Callback error:', error.response?.data || error.message);
    res.redirect(`${INSTAGRAM_CONFIG.frontendUrl}?error=oauth_failed&message=${encodeURIComponent(error.message)}`);
  }
});

// ==================== INSTAGRAM MESSAGING WEBHOOKS ====================

// Route: Verify Webhook (required by Facebook)
app.get('/api/instagram/webhook', (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log('[Webhook] Verification request received');
    console.log('[Webhook] Mode:', mode, 'Token match:', token === WEBHOOK_VERIFY_TOKEN);

    if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
      console.log('[Webhook] Verification successful');
      res.status(200).send(challenge);
    } else {
      console.error('[Webhook] Verification failed - invalid token');
      res.sendStatus(403);
    }
  } catch (error) {
    console.error('[Webhook] Verification error:', error.message);
    res.sendStatus(500);
  }
});

// Route: Receive Webhook Events (messages, reactions, etc.)
app.post('/api/instagram/webhook', (req, res) => {
  try {
    // Verify the webhook signature from Instagram
    if (!verifyWebhookSignature(req)) {
      console.error('[Webhook] Request rejected - invalid signature');
      return res.sendStatus(403);
    }

    const body = req.body;

    console.log('[Webhook] Event received:', JSON.stringify(body, null, 2));

    if (body.object === 'instagram') {
      body.entry.forEach(entry => {
        // Get messaging events
        const messaging = entry.messaging || [];

        messaging.forEach(event => {
          const senderId = event.sender.id; // IGSID
          const recipientId = event.recipient.id; // Your page's IGSID

          // Handle message event
          if (event.message) {
            const messageData = {
              id: event.message.mid,
              senderId,
              recipientId,
              text: event.message.text || null,
              attachments: event.message.attachments || [],
              timestamp: event.timestamp,
              received: new Date()
            };

            console.log('[Webhook] Message received from:', senderId);
            console.log('[Webhook] Message text:', messageData.text);

            // Store message
            if (!messageStore.has(senderId)) {
              messageStore.set(senderId, []);
            }
            messageStore.get(senderId).push(messageData);

            // Update conversation
            const conversationId = `${senderId}_${recipientId}`;
            conversationStore.set(conversationId, {
              id: conversationId,
              senderId,
              recipientId,
              lastMessage: messageData,
              lastMessageTime: messageData.timestamp,
              unreadCount: (conversationStore.get(conversationId)?.unreadCount || 0) + 1
            });

            console.log('[Webhook] Message stored. Total messages from sender:', messageStore.get(senderId).length);
          }

          // Handle reaction event
          if (event.reaction) {
            console.log('[Webhook] Reaction received:', event.reaction);
          }

          // Handle postback event (for quick replies)
          if (event.postback) {
            console.log('[Webhook] Postback received:', event.postback);
          }
        });
      });

      res.status(200).send('EVENT_RECEIVED');
    } else {
      res.sendStatus(404);
    }
  } catch (error) {
    console.error('[Webhook] Processing error:', error.message);
    res.status(500).send('ERROR');
  }
});

// ==================== INSTAGRAM MESSAGING API ====================

// Route: Send Message
app.post('/api/instagram/send-message', async (req, res) => {
  try {
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
    const { recipientId, message } = req.body;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    if (!recipientId || !message) {
      return res.status(400).json({
        success: false,
        error: 'recipientId and message are required'
      });
    }

    console.log('[Messaging] Sending message to:', recipientId);

    // Check if message is within 24-hour window
    const conversation = Array.from(conversationStore.values())
      .find(c => c.senderId === recipientId);

    if (conversation) {
      const lastMessageTime = conversation.lastMessageTime;
      const hoursSinceLastMessage = (Date.now() - lastMessageTime) / (1000 * 60 * 60);

      if (hoursSinceLastMessage > 24) {
        return res.status(400).json({
          success: false,
          error: '24_HOUR_WINDOW_EXPIRED',
          message: 'Cannot send message - 24 hour messaging window has expired',
          lastMessageTime: new Date(lastMessageTime).toISOString(),
          hoursSinceLastMessage: Math.round(hoursSinceLastMessage)
        });
      }
    }

    const response = await axios.post(
      `${INSTAGRAM_CONFIG.graphBaseUrl}/me/messages`,
      {
        recipient: { id: recipientId },
        message: { text: message }
      },
      {
        params: { access_token: token },
        headers: { 'Content-Type': 'application/json' }
      }
    );

    console.log('[Messaging] Message sent successfully');

    res.json({
      success: true,
      data: response.data,
      message: 'Message sent successfully'
    });

  } catch (error) {
    console.error('[Messaging] Send error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: 'Failed to send message',
      message: error.message,
      details: error.response?.data
    });
  }
});

// Route: Get All Conversations
app.get('/api/instagram/conversations', (req, res) => {
  try {
    console.log('[Messaging] Fetching all conversations');

    const conversations = Array.from(conversationStore.values()).map(conv => {
      const hoursSinceLastMessage = (Date.now() - conv.lastMessageTime) / (1000 * 60 * 60);
      const canReply = hoursSinceLastMessage <= 24;

      return {
        ...conv,
        canReply,
        hoursSinceLastMessage: Math.round(hoursSinceLastMessage),
        lastMessageTimeFormatted: new Date(conv.lastMessageTime).toISOString()
      };
    });

    // Sort by most recent first
    conversations.sort((a, b) => b.lastMessageTime - a.lastMessageTime);

    console.log('[Messaging] Found', conversations.length, 'conversations');

    res.json({
      success: true,
      count: conversations.length,
      data: conversations
    });

  } catch (error) {
    console.error('[Messaging] Fetch conversations error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversations',
      message: error.message
    });
  }
});

// Route: Get Messages from a Specific Sender
app.get('/api/instagram/messages/:senderId', (req, res) => {
  try {
    const { senderId } = req.params;

    console.log('[Messaging] Fetching messages from:', senderId);

    const messages = messageStore.get(senderId) || [];

    res.json({
      success: true,
      senderId,
      count: messages.length,
      data: messages
    });

  } catch (error) {
    console.error('[Messaging] Fetch messages error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch messages',
      message: error.message
    });
  }
});

// Route: Clear Message Store (for testing)
app.delete('/api/instagram/messages/clear', (req, res) => {
  try {
    messageStore.clear();
    conversationStore.clear();

    console.log('[Messaging] Message stores cleared');

    res.json({
      success: true,
      message: 'Message stores cleared'
    });

  } catch (error) {
    console.error('[Messaging] Clear error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to clear messages',
      message: error.message
    });
  }
});

// Route: Get Profile Data
app.get('/api/instagram/profile', async (req, res) => {
  try {
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required',
        message: 'Pass token as query param ?token=XXX or Authorization header'
      });
    }

    console.log('[Profile] Fetching profile data');

    const fields = 'id,username,account_type,media_count,followers_count,follows_count,profile_picture_url,biography,website';

    const response = await axios.get(
      `${INSTAGRAM_CONFIG.graphBaseUrl}/me`,
      {
        params: {
          fields,
          access_token: token
        }
      }
    );

    console.log('[Profile] Profile data fetched for user:', response.data.username);

    res.json({
      success: true,
      data: response.data
    });

  } catch (error) {
    console.error('[Profile] Fetch error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: 'Failed to fetch profile',
      message: error.message,
      details: error.response?.data
    });
  }
});

// Route: Get Media (Posts & Reels)
app.get('/api/instagram/media', async (req, res) => {
  try {
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
    const limit = req.query.limit || 25;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required',
        message: 'Pass token as query param ?token=XXX or Authorization header'
      });
    }

    console.log('[Media] Fetching media data');

    const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count,is_shared_to_feed';

    const response = await axios.get(
      `${INSTAGRAM_CONFIG.graphBaseUrl}/me/media`,
      {
        params: {
          fields,
          limit,
          access_token: token
        }
      }
    );

    const media = response.data.data || [];

    // Separate posts and reels
    const posts = media.filter(m => m.media_type === 'IMAGE' || m.media_type === 'CAROUSEL_ALBUM');
    const reels = media.filter(m => m.media_type === 'VIDEO');

    console.log(`[Media] Media fetched: ${posts.length} posts, ${reels.length} reels`);

    res.json({
      success: true,
      total: media.length,
      posts: posts.length,
      reels: reels.length,
      data: media,
      paging: response.data.paging
    });

  } catch (error) {
    console.error('[Media] Fetch error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: 'Failed to fetch media',
      message: error.message,
      details: error.response?.data
    });
  }
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    message: 'Instagram Graph API server running',
    storedTokens: tokenStore.size,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Error handler
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

// Start server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log('\n[Server] Instagram Graph API Server');
  console.log(`[Server] Running on: http://localhost:${PORT}`);
  console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[Server] Frontend URL: ${process.env.FRONTEND_URL}`);
  console.log(`[Server] OAuth Callback: ${process.env.INSTAGRAM_REDIRECT_URI}`);
  console.log(`[Server] Webhook URL: ${process.env.NODE_ENV === 'production' ? 'https://myautomation-test3.onrender.com' : 'http://localhost:' + PORT}/api/instagram/webhook`);
  console.log(`[Server] Webhook Verify Token: ${WEBHOOK_VERIFY_TOKEN ? '*** (set)' : 'NOT SET'}\n`);
});

module.exports = app;
