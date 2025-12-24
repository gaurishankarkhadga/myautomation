require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();

// Middleware - Allow both local and production
const allowedOrigins = [
  'http://localhost:5173',
  'https://mydmtestingapp.netlify.app',
  process.env.FRONTEND_URL
].filter(Boolean);

console.log(allowedOrigins);


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
app.use(express.json());

// In-memory storage for tokens (for testing only)
const tokenStore = new Map();


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
    res.redirect(`${INSTAGRAM_CONFIG.frontendUrl}?error=oauth_failed&message=${error.message}`);
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
  console.log(`[Server] Frontend URL: ${process.env.FRONTEND_URL}\n`);
});

module.exports = app;
