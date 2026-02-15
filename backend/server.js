require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');

const app = express();

const allowedOrigins = [...new Set([
  'http://localhost:5173',
  'https://mydmtestingapp.netlify.app',
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


const tokenStore = new Map();

const messageStore = new Map();
const conversationStore = new Map();
const igsidMap = new Map();

// Auto-Reply stores (Comments)
const autoReplySettings = new Map();  // igUserId -> { enabled, delaySeconds, message }
const autoReplyLog = [];              // [{ commentId, commentText, commenterUsername, mediaId, replyText, status, scheduledAt, repliedAt, error }]
const pendingReplies = new Map();     // commentId -> timeoutId

// Auto-Reply stores (DMs)
const dmAutoReplySettings = new Map();  // igUserId -> { enabled, delaySeconds, message }
const dmAutoReplyLog = [];              // [{ senderId, senderIGSID, messageText, replyText, status, scheduledAt, repliedAt, error }]
const pendingDMReplies = new Map();     // senderId -> timeoutId

// Webhook event tracking (for debugging)
const webhookEventLog = [];            // Last 50 webhook events received
let webhookEventCount = 0;


// Instagram Graph API Configuration
const INSTAGRAM_CONFIG = {
  appId: process.env.INSTAGRAM_APP_ID,
  appSecret: process.env.INSTAGRAM_APP_SECRET,
  redirectUri: process.env.INSTAGRAM_REDIRECT_URI,
  frontendUrl: process.env.FRONTEND_URL,
  oauthBaseUrl: 'https://api.instagram.com/oauth',
  graphBaseUrl: 'https://graph.instagram.com/v24.0',
  scopes: ['instagram_business_basic', 'instagram_business_manage_messages', 'instagram_business_manage_comments', 'instagram_business_content_publish']
};

// Webhook Configuration
const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;

function verifyWebhookSignature(req) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature || !req.rawBody) {
    console.log('[Webhook] No signature or raw body available - skipping verification');
    return true;
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

// Helper: Auto-reply to a comment using Instagram Graph API
async function replyToComment(commentId, message, accessToken) {
  try {
    console.log('[AutoReply] Replying to comment:', commentId);

    const response = await axios.post(
      `${INSTAGRAM_CONFIG.graphBaseUrl}/${commentId}/replies`,
      null,
      {
        params: {
          message: message,
          access_token: accessToken
        }
      }
    );

    console.log('[AutoReply] Reply sent successfully. Reply ID:', response.data.id);
    return { success: true, replyId: response.data.id };
  } catch (error) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    console.error('[AutoReply] Failed to reply:', errorMsg);
    console.error('[AutoReply] Full error:', JSON.stringify(error.response?.data, null, 2));
    return { success: false, error: errorMsg };
  }
}

// Helper: Send a direct message using Instagram Graph API
async function sendDirectMessage(igUserId, recipientIGSID, message, accessToken) {
  try {
    console.log('[DM-AutoReply] Sending DM to IGSID:', recipientIGSID);

    const response = await axios.post(
      `${INSTAGRAM_CONFIG.graphBaseUrl}/${igUserId}/messages`,
      {
        recipient: { id: recipientIGSID },
        message: { text: message }
      },
      {
        params: {
          access_token: accessToken
        },
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('[DM-AutoReply] DM sent successfully. Response:', JSON.stringify(response.data));
    return { success: true, data: response.data };
  } catch (error) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    console.error('[DM-AutoReply] Failed to send DM:', errorMsg);
    console.error('[DM-AutoReply] Full error:', JSON.stringify(error.response?.data, null, 2));
    return { success: false, error: errorMsg };
  }
}

// Helper: Schedule a delayed auto-reply
function scheduleAutoReply(commentData, igUserId) {
  const settings = autoReplySettings.get(igUserId);
  if (!settings || !settings.enabled) {
    console.log('[AutoReply] Auto-reply disabled for user:', igUserId);
    return;
  }

  // Don't reply to replies (only top-level comments)
  if (commentData.parentId) {
    console.log('[AutoReply] Skipping reply to sub-comment:', commentData.commentId);
    return;
  }

  // Don't reply if already pending/replied
  if (pendingReplies.has(commentData.commentId)) {
    console.log('[AutoReply] Already scheduled for comment:', commentData.commentId);
    return;
  }

  // Get access token for this user
  const tokenData = tokenStore.get(igUserId);
  if (!tokenData) {
    console.error('[AutoReply] No access token found for user:', igUserId);
    const logEntry = {
      commentId: commentData.commentId,
      commentText: commentData.text,
      commenterUsername: commentData.username,
      mediaId: commentData.mediaId,
      replyText: settings.message,
      status: 'failed',
      error: 'No access token found',
      scheduledAt: new Date().toISOString(),
      repliedAt: null
    };
    autoReplyLog.unshift(logEntry);
    return;
  }

  const delayMs = (settings.delaySeconds || 10) * 1000;
  console.log(`[AutoReply] Scheduling reply in ${settings.delaySeconds}s for comment: ${commentData.commentId}`);

  // Add log entry as 'pending'
  const logEntry = {
    commentId: commentData.commentId,
    commentText: commentData.text,
    commenterUsername: commentData.username,
    mediaId: commentData.mediaId,
    replyText: settings.message,
    status: 'pending',
    error: null,
    scheduledAt: new Date().toISOString(),
    repliedAt: null
  };
  autoReplyLog.unshift(logEntry);

  // Keep log to max 100 entries
  if (autoReplyLog.length > 100) {
    autoReplyLog.length = 100;
  }

  const timeoutId = setTimeout(async () => {
    const result = await replyToComment(commentData.commentId, settings.message, tokenData.accessToken);

    // Update log entry
    const entry = autoReplyLog.find(e => e.commentId === commentData.commentId);
    if (entry) {
      entry.status = result.success ? 'sent' : 'failed';
      entry.repliedAt = new Date().toISOString();
      entry.error = result.error || null;
      if (result.replyId) entry.replyId = result.replyId;
    }

    pendingReplies.delete(commentData.commentId);
    console.log(`[AutoReply] Reply ${result.success ? 'sent' : 'failed'} for comment: ${commentData.commentId}`);
  }, delayMs);

  pendingReplies.set(commentData.commentId, timeoutId);
}

// Helper: Schedule a delayed auto-reply to DM
function scheduleDMAutoReply(messageData, igUserId) {
  const settings = dmAutoReplySettings.get(igUserId);
  if (!settings || !settings.enabled) {
    console.log('[DM-AutoReply] DM auto-reply disabled for user:', igUserId);
    return;
  }

  const senderId = messageData.senderId;

  // Don't reply to own messages (echo prevention)
  if (senderId === igUserId) {
    console.log('[DM-AutoReply] Skipping echo (own message)');
    return;
  }

  // Don't reply if already pending
  if (pendingDMReplies.has(senderId)) {
    console.log('[DM-AutoReply] Already scheduled for sender:', senderId);
    return;
  }

  // Get access token for this user
  const tokenData = tokenStore.get(igUserId);
  if (!tokenData) {
    console.error('[DM-AutoReply] No access token found for user:', igUserId);
    const logEntry = {
      senderId,
      messageText: messageData.text,
      replyText: settings.message,
      status: 'failed',
      error: 'No access token found',
      scheduledAt: new Date().toISOString(),
      repliedAt: null
    };
    dmAutoReplyLog.unshift(logEntry);
    return;
  }

  const delayMs = (settings.delaySeconds || 10) * 1000;
  console.log(`[DM-AutoReply] Scheduling DM reply in ${settings.delaySeconds}s for sender: ${senderId}`);

  // Add log entry as 'pending'
  const logEntry = {
    senderId,
    messageText: messageData.text,
    replyText: settings.message,
    status: 'pending',
    error: null,
    scheduledAt: new Date().toISOString(),
    repliedAt: null
  };
  dmAutoReplyLog.unshift(logEntry);

  // Keep log to max 100 entries
  if (dmAutoReplyLog.length > 100) {
    dmAutoReplyLog.length = 100;
  }

  const timeoutId = setTimeout(async () => {
    const result = await sendDirectMessage(igUserId, senderId, settings.message, tokenData.accessToken);

    // Update log entry
    const entry = dmAutoReplyLog.find(e => e.senderId === senderId && e.status === 'pending');
    if (entry) {
      entry.status = result.success ? 'sent' : 'failed';
      entry.repliedAt = new Date().toISOString();
      entry.error = result.error || null;
    }

    pendingDMReplies.delete(senderId);
    console.log(`[DM-AutoReply] DM reply ${result.success ? 'sent' : 'failed'} for sender: ${senderId}`);
  }, delayMs);

  pendingDMReplies.set(senderId, timeoutId);
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

    // Track webhook events for debugging
    webhookEventCount++;
    webhookEventLog.unshift({
      receivedAt: new Date().toISOString(),
      object: body.object,
      entryCount: body.entry?.length || 0,
      raw: JSON.stringify(body).substring(0, 500)
    });
    if (webhookEventLog.length > 50) webhookEventLog.length = 50;

    if (body.object === 'instagram') {
      body.entry.forEach(entry => {
        const igUserId = entry.id;

        // ---- Handle Comment Events (changes array) ----
        const changes = entry.changes || [];
        changes.forEach(change => {
          if (change.field === 'comments') {
            const commentValue = change.value;
            console.log('[Webhook] Comment event received:', JSON.stringify(commentValue, null, 2));

            const commentData = {
              commentId: commentValue.comment_id || commentValue.id,
              text: commentValue.text,
              username: commentValue.from?.username || 'unknown',
              senderId: commentValue.from?.id,
              mediaId: commentValue.media?.id,
              mediaProductType: commentValue.media?.media_product_type,
              parentId: commentValue.parent_id || null,
              timestamp: commentValue.timestamp
            };

            console.log(`[Webhook] Comment from @${commentData.username}: "${commentData.text}"`);

            // Trigger auto-reply if enabled
            scheduleAutoReply(commentData, igUserId);
          }
        });

        // ---- Handle Messaging Events (messaging array) ----
        const messaging = entry.messaging || [];

        messaging.forEach(event => {
          const senderId = event.sender.id;
          const recipientId = event.recipient.id;

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

            // Trigger DM auto-reply if enabled
            scheduleDMAutoReply(messageData, recipientId);
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
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
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

// ==================== INSTAGRAM AUTO-REPLY TO COMMENTS ====================

// Route: Save Auto-Reply Settings
app.post('/api/instagram/auto-reply/settings', (req, res) => {
  try {
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
    const { userId, enabled, delaySeconds, message } = req.body;

    if (!token || !userId) {
      return res.status(400).json({
        success: false,
        error: 'token and userId are required'
      });
    }

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Reply message cannot be empty'
      });
    }

    const delay = Math.min(Math.max(parseInt(delaySeconds) || 10, 5), 300);

    autoReplySettings.set(userId, {
      enabled: Boolean(enabled),
      delaySeconds: delay,
      message: message.trim()
    });

    // Always update token (needed for replying after server restart)
    tokenStore.set(userId, {
      accessToken: token,
      createdAt: new Date()
    });

    console.log(`[AutoReply] Settings saved for user ${userId}: enabled=${enabled}, delay=${delay}s`);

    res.json({
      success: true,
      message: 'Auto-reply settings saved',
      data: autoReplySettings.get(userId)
    });

  } catch (error) {
    console.error('[AutoReply] Settings save error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to save settings',
      message: error.message
    });
  }
});

// Route: Get Auto-Reply Settings
app.get('/api/instagram/auto-reply/settings', (req, res) => {
  try {
    const userId = req.query.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId query param is required'
      });
    }

    const settings = autoReplySettings.get(userId) || {
      enabled: false,
      delaySeconds: 10,
      message: 'Thanks for your comment! 🙏'
    };

    res.json({
      success: true,
      data: settings
    });

  } catch (error) {
    console.error('[AutoReply] Settings fetch error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch settings',
      message: error.message
    });
  }
});

// Route: Get Auto-Reply Log
app.get('/api/instagram/auto-reply/log', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const logs = autoReplyLog.slice(0, limit);

    res.json({
      success: true,
      count: logs.length,
      total: autoReplyLog.length,
      pendingCount: pendingReplies.size,
      data: logs
    });

  } catch (error) {
    console.error('[AutoReply] Log fetch error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch log',
      message: error.message
    });
  }
});

// Route: Clear Auto-Reply Log
app.delete('/api/instagram/auto-reply/log', (req, res) => {
  try {
    // Cancel all pending replies
    for (const [commentId, timeoutId] of pendingReplies.entries()) {
      clearTimeout(timeoutId);
      console.log('[AutoReply] Cancelled pending reply for:', commentId);
    }
    pendingReplies.clear();
    autoReplyLog.length = 0;

    console.log('[AutoReply] Log cleared and pending replies cancelled');

    res.json({
      success: true,
      message: 'Auto-reply log cleared and pending replies cancelled'
    });

  } catch (error) {
    console.error('[AutoReply] Log clear error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to clear log',
      message: error.message
    });
  }
});

// ==================== DM AUTO-REPLY ENDPOINTS ====================

// Route: Save DM Auto-Reply Settings
app.post('/api/instagram/dm-auto-reply/settings', (req, res) => {
  try {
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
    const { userId, enabled, delaySeconds, message } = req.body;

    if (!token || !userId) {
      return res.status(400).json({
        success: false,
        error: 'token and userId are required'
      });
    }

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Reply message cannot be empty'
      });
    }

    const delay = Math.min(Math.max(parseInt(delaySeconds) || 10, 5), 300);

    dmAutoReplySettings.set(userId, {
      enabled: Boolean(enabled),
      delaySeconds: delay,
      message: message.trim()
    });

    // Always update token (needed for replying after server restart)
    tokenStore.set(userId, {
      accessToken: token,
      createdAt: new Date()
    });

    console.log(`[DM-AutoReply] Settings saved for user ${userId}: enabled=${enabled}, delay=${delay}s`);

    res.json({
      success: true,
      message: 'DM auto-reply settings saved',
      data: dmAutoReplySettings.get(userId)
    });

  } catch (error) {
    console.error('[DM-AutoReply] Settings save error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to save DM auto-reply settings',
      message: error.message
    });
  }
});

// Route: Get DM Auto-Reply Settings
app.get('/api/instagram/dm-auto-reply/settings', (req, res) => {
  try {
    const userId = req.query.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId query param is required'
      });
    }

    const settings = dmAutoReplySettings.get(userId) || {
      enabled: false,
      delaySeconds: 10,
      message: 'Thanks for reaching out! I will get back to you shortly.'
    };

    res.json({
      success: true,
      data: settings
    });

  } catch (error) {
    console.error('[DM-AutoReply] Settings fetch error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch DM auto-reply settings',
      message: error.message
    });
  }
});

// Route: Get DM Auto-Reply Log
app.get('/api/instagram/dm-auto-reply/log', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const logs = dmAutoReplyLog.slice(0, limit);

    res.json({
      success: true,
      count: logs.length,
      total: dmAutoReplyLog.length,
      pendingCount: pendingDMReplies.size,
      data: logs
    });

  } catch (error) {
    console.error('[DM-AutoReply] Log fetch error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch DM auto-reply log',
      message: error.message
    });
  }
});

// Route: Clear DM Auto-Reply Log
app.delete('/api/instagram/dm-auto-reply/log', (req, res) => {
  try {
    // Cancel all pending DM replies
    for (const [senderId, timeoutId] of pendingDMReplies.entries()) {
      clearTimeout(timeoutId);
      console.log('[DM-AutoReply] Cancelled pending DM reply for:', senderId);
    }
    pendingDMReplies.clear();
    dmAutoReplyLog.length = 0;

    console.log('[DM-AutoReply] DM log cleared and pending replies cancelled');

    res.json({
      success: true,
      message: 'DM auto-reply log cleared and pending replies cancelled'
    });

  } catch (error) {
    console.error('[DM-AutoReply] Log clear error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to clear DM auto-reply log',
      message: error.message
    });
  }
});

// ==================== WEBHOOK SUBSCRIPTION ====================

// Route: Subscribe to webhook fields (REQUIRED for receiving events)
app.post('/api/instagram/subscribe-webhooks', async (req, res) => {
  try {
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    // First, get the user's Instagram ID so we can store the token
    let igUserId = null;
    try {
      const meResponse = await axios.get(`${INSTAGRAM_CONFIG.graphBaseUrl}/me`, {
        params: { fields: 'id', access_token: token }
      });
      igUserId = meResponse.data.id;
      console.log('[Webhooks] Resolved IG user ID:', igUserId);

      // Store token for this user (needed for auto-reply)
      tokenStore.set(igUserId, {
        accessToken: token,
        createdAt: new Date()
      });
      console.log('[Webhooks] Token stored for user:', igUserId);
    } catch (meErr) {
      console.error('[Webhooks] Could not resolve user ID:', meErr.response?.data || meErr.message);
    }

    console.log('[Webhooks] Subscribing to webhook fields: comments, messages');

    const response = await axios.post(
      `${INSTAGRAM_CONFIG.graphBaseUrl}/me/subscribed_apps`,
      null,
      {
        params: {
          subscribed_fields: 'comments,messages',
          access_token: token
        }
      }
    );

    console.log('[Webhooks] Subscription response:', JSON.stringify(response.data));

    res.json({
      success: true,
      message: 'Webhook subscriptions enabled for comments and messages',
      data: response.data,
      igUserId: igUserId,
      tokenStored: !!igUserId
    });

  } catch (error) {
    console.error('[Webhooks] Subscription error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: 'Failed to subscribe to webhooks',
      message: error.message,
      details: error.response?.data
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

// ==================== META PLATFORM CALLBACKS ====================

// Helper: Parse Meta signed_request
function parseSignedRequest(signedRequest) {
  try {
    const [encodedSig, payload] = signedRequest.split('.');
    const data = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));

    const expectedSig = crypto
      .createHmac('sha256', INSTAGRAM_CONFIG.appSecret)
      .update(payload)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    if (encodedSig !== expectedSig) {
      console.error('[Meta] Signed request signature mismatch');
      return null;
    }

    return data;
  } catch (error) {
    console.error('[Meta] Failed to parse signed_request:', error.message);
    return null;
  }
}

// Route: Deauthorize Callback (called when user removes app from Instagram)
app.post('/api/instagram/deauthorize', (req, res) => {
  try {
    const { signed_request } = req.body;

    if (signed_request) {
      const data = parseSignedRequest(signed_request);
      if (data && data.user_id) {
        console.log('[Deauthorize] User removed app, user_id:', data.user_id);

        // Remove stored token for this user
        tokenStore.delete(data.user_id);

        // Clean up any stored messages/conversations
        messageStore.delete(data.user_id);
      }
    }

    console.log('[Deauthorize] Callback processed successfully');
    res.json({ success: true });
  } catch (error) {
    console.error('[Deauthorize] Error:', error.message);
    res.json({ success: true });
  }
});

// Route: Data Deletion Request (GDPR/CCPA compliance, required by Meta)
app.post('/api/instagram/data-deletion', (req, res) => {
  try {
    const { signed_request } = req.body;
    let userId = 'unknown';

    if (signed_request) {
      const data = parseSignedRequest(signed_request);
      if (data && data.user_id) {
        userId = data.user_id;
        console.log('[DataDeletion] Request received for user_id:', userId);

        // Delete all user data
        tokenStore.delete(userId);
        messageStore.delete(userId);

        // Clean up conversations involving this user
        for (const [key, conv] of conversationStore.entries()) {
          if (conv.senderId === userId || conv.recipientId === userId) {
            conversationStore.delete(key);
          }
        }
      }
    }

    const confirmationCode = `DEL-${userId}-${Date.now()}`;
    const statusUrl = `${INSTAGRAM_CONFIG.frontendUrl}/data-deletion?code=${confirmationCode}`;

    console.log('[DataDeletion] Processed. Code:', confirmationCode);

    res.json({
      url: statusUrl,
      confirmation_code: confirmationCode
    });
  } catch (error) {
    console.error('[DataDeletion] Error:', error.message);
    res.json({
      url: `${INSTAGRAM_CONFIG.frontendUrl}/data-deletion`,
      confirmation_code: `DEL-error-${Date.now()}`
    });
  }
});

// ==================== DEBUG ENDPOINTS ====================

// Route: Debug Status (shows all stored states for debugging)
app.get('/api/instagram/debug/status', (req, res) => {
  const tokenEntries = [];
  for (const [userId, data] of tokenStore.entries()) {
    tokenEntries.push({
      userId,
      hasToken: !!data.accessToken,
      tokenPreview: data.accessToken ? data.accessToken.substring(0, 20) + '...' : null,
      createdAt: data.createdAt
    });
  }

  const commentSettings = [];
  for (const [userId, settings] of autoReplySettings.entries()) {
    commentSettings.push({ userId, ...settings });
  }

  const dmSettings = [];
  for (const [userId, settings] of dmAutoReplySettings.entries()) {
    dmSettings.push({ userId, ...settings });
  }

  res.json({
    success: true,
    serverUptime: Math.round(process.uptime()) + 's',
    tokens: {
      count: tokenStore.size,
      entries: tokenEntries
    },
    commentAutoReply: {
      settingsCount: autoReplySettings.size,
      settings: commentSettings,
      logCount: autoReplyLog.length,
      pendingReplies: pendingReplies.size,
      recentLog: autoReplyLog.slice(0, 5)
    },
    dmAutoReply: {
      settingsCount: dmAutoReplySettings.size,
      settings: dmSettings,
      logCount: dmAutoReplyLog.length,
      pendingReplies: pendingDMReplies.size,
      recentLog: dmAutoReplyLog.slice(0, 5)
    },
    webhooks: {
      totalEventsReceived: webhookEventCount,
      recentEvents: webhookEventLog.slice(0, 10)
    }
  });
});

// Route: Test Comment Webhook (simulates a comment webhook for debugging)
app.post('/api/instagram/debug/test-comment-webhook', (req, res) => {
  try {
    const { userId, commentText, commentId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required (your Instagram user ID)'
      });
    }

    const testCommentData = {
      commentId: commentId || `test_${Date.now()}`,
      text: commentText || 'This is a test comment',
      username: 'test_user',
      senderId: 'test_sender',
      mediaId: 'test_media',
      mediaProductType: 'FEED',
      parentId: null,
      timestamp: Date.now()
    };

    const settings = autoReplySettings.get(userId);
    const tokenData = tokenStore.get(userId);

    // Run the auto-reply flow
    scheduleAutoReply(testCommentData, userId);

    res.json({
      success: true,
      message: 'Test comment webhook simulated',
      debug: {
        userId,
        settingsFound: !!settings,
        settingsEnabled: settings?.enabled || false,
        tokenFound: !!tokenData,
        commentData: testCommentData
      }
    });

  } catch (error) {
    console.error('[Debug] Test webhook error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Route: Test DM Webhook (simulates a DM webhook for debugging)
app.post('/api/instagram/debug/test-dm-webhook', (req, res) => {
  try {
    const { userId, messageText, senderId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required (your Instagram user ID)'
      });
    }

    const testMessageData = {
      id: `test_msg_${Date.now()}`,
      senderId: senderId || 'test_sender_123',
      recipientId: userId,
      text: messageText || 'This is a test DM',
      attachments: [],
      timestamp: Date.now(),
      received: new Date()
    };

    const settings = dmAutoReplySettings.get(userId);
    const tokenData = tokenStore.get(userId);

    // Run the DM auto-reply flow
    scheduleDMAutoReply(testMessageData, userId);

    res.json({
      success: true,
      message: 'Test DM webhook simulated',
      debug: {
        userId,
        settingsFound: !!settings,
        settingsEnabled: settings?.enabled || false,
        tokenFound: !!tokenData,
        messageData: testMessageData
      }
    });

  } catch (error) {
    console.error('[Debug] Test DM webhook error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
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


