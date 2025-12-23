require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
}));
app.use(express.json());

// In-memory storage for tokens (for testing only)
const tokenStore = new Map();

// ============================================
// INSTAGRAM GRAPH API CONFIGURATION
// ============================================
const INSTAGRAM_CONFIG = {
    appId: process.env.INSTAGRAM_APP_ID,
    appSecret: process.env.INSTAGRAM_APP_SECRET,
    redirectUri: process.env.INSTAGRAM_REDIRECT_URI,
    oauthBaseUrl: 'https://api.instagram.com/oauth',
    graphBaseUrl: 'https://graph.instagram.com',
    scopes: ['instagram_business_basic', 'instagram_business_manage_messages', 'instagram_business_manage_comments', 'instagram_business_content_publish']
};

// ============================================
// ROUTE 1: GET OAUTH URL
// ============================================
app.get('/api/instagram/auth', (req, res) => {
    try {
        const params = new URLSearchParams({
            client_id: INSTAGRAM_CONFIG.appId,
            redirect_uri: INSTAGRAM_CONFIG.redirectUri,
            scope: INSTAGRAM_CONFIG.scopes.join(','),
            response_type: 'code'
        });

        const authUrl = `${INSTAGRAM_CONFIG.oauthBaseUrl}/authorize?${params.toString()}`;

        console.log('🔗 Generated OAuth URL:', authUrl);

        // Return JSON for API or redirect for browser
        if (req.query.format === 'json') {
            res.json({ authUrl });
        } else {
            res.redirect(authUrl);
        }
    } catch (error) {
        console.error('❌ Auth URL generation error:', error.message);
        res.status(500).json({ error: 'Failed to generate auth URL', message: error.message });
    }
});

// ============================================
// ROUTE 2: HANDLE OAUTH CALLBACK
// ============================================
app.get('/api/instagram/callback', async (req, res) => {
    try {
        const { code, error, error_reason, error_description } = req.query;

        // Handle Instagram OAuth errors
        if (error) {
            console.error('❌ Instagram OAuth error:', error_reason, error_description);
            return res.status(400).send(`
        <html>
          <body style="font-family: Arial; padding: 40px; text-align: center;">
            <h2>❌ Instagram Connection Failed</h2>
            <p><strong>Error:</strong> ${error_reason}</p>
            <p>${error_description}</p>
            <a href="/api/instagram/auth" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background: #E1306C; color: white; text-decoration: none; border-radius: 5px;">Try Again</a>
          </body>
        </html>
      `);
        }

        if (!code) {
            return res.status(400).json({ error: 'No authorization code received' });
        }

        console.log('📩 Received authorization code:', code.substring(0, 20) + '...');

        // Step 1: Exchange code for short-lived token
        console.log('🔄 Step 1: Exchanging code for token...');
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
        console.log('✅ Short-lived token received for user:', userId);

        // Step 2: Exchange for long-lived token (60 days)
        console.log('🔄 Step 2: Getting long-lived token...');
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
        console.log('✅ Long-lived token received (expires in', expiresIn, 'seconds)');

        // Store token in memory
        tokenStore.set(userId, {
            accessToken: longLivedToken,
            expiresIn,
            createdAt: new Date()
        });

        // Return success page with token
        res.send(`
      <html>
        <head>
          <style>
            body { font-family: Arial; padding: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; color: #333; }
            h2 { color: #E1306C; }
            .token-box { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; word-break: break-all; font-family: monospace; font-size: 12px; }
            .btn { display: inline-block; padding: 12px 24px; background: #E1306C; color: white; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
            .info { background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>✅ Instagram Connected Successfully!</h2>
            <p><strong>User ID:</strong> ${userId}</p>
            <p><strong>Token expires in:</strong> ${Math.floor(expiresIn / 86400)} days</p>
            
            <div class="info">
              <strong>📋 Your Access Token:</strong>
              <div class="token-box">${longLivedToken}</div>
              <small>Copy this token to test the API endpoints below</small>
            </div>

            <h3>🧪 Test Endpoints:</h3>
            <a href="/api/instagram/profile?token=${longLivedToken}" class="btn" target="_blank">View Profile</a>
            <a href="/api/instagram/media?token=${longLivedToken}" class="btn" target="_blank">View Media</a>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
              <small><strong>Note:</strong> Token is stored in server memory for testing. It will be lost on server restart.</small>
            </div>
          </div>
        </body>
      </html>
    `);

    } catch (error) {
        console.error('❌ OAuth callback error:', error.response?.data || error.message);
        res.status(500).json({
            error: 'OAuth callback failed',
            message: error.message,
            details: error.response?.data
        });
    }
});

// ============================================
// ROUTE 3: GET PROFILE DATA
// ============================================
app.get('/api/instagram/profile', async (req, res) => {
    try {
        const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ error: 'Access token required. Pass as ?token=YOUR_TOKEN or Authorization header' });
        }

        console.log('👤 Fetching profile data...');

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

        console.log('✅ Profile data fetched:', response.data.username);
        res.json(response.data);

    } catch (error) {
        console.error('❌ Profile fetch error:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Failed to fetch profile',
            message: error.message,
            details: error.response?.data
        });
    }
});

// ============================================
// ROUTE 4: GET MEDIA (POSTS & REELS)
// ============================================
app.get('/api/instagram/media', async (req, res) => {
    try {
        const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
        const limit = req.query.limit || 25;

        if (!token) {
            return res.status(401).json({ error: 'Access token required. Pass as ?token=YOUR_TOKEN or Authorization header' });
        }

        console.log('📸 Fetching media data...');

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

        console.log(`✅ Media fetched: ${posts.length} posts, ${reels.length} reels`);

        res.json({
            total: media.length,
            posts: posts.length,
            reels: reels.length,
            data: media,
            paging: response.data.paging
        });

    } catch (error) {
        console.error('❌ Media fetch error:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Failed to fetch media',
            message: error.message,
            details: error.response?.data
        });
    }
});

// ============================================
// HEALTH CHECK
// ============================================
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Minimal Instagram Graph API server is running',
        storedTokens: tokenStore.size
    });
});

// ============================================
// HOME PAGE
// ============================================
app.get('/', (req, res) => {
    res.send(`
    <html>
      <head>
        <style>
          body { font-family: Arial; padding: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
          .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; color: #333; }
          h1 { color: #E1306C; }
          .endpoint { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #E1306C; }
          .method { display: inline-block; padding: 4px 8px; background: #4CAF50; color: white; border-radius: 3px; font-size: 12px; margin-right: 10px; }
          code { background: #e0e0e0; padding: 2px 6px; border-radius: 3px; }
          a { color: #E1306C; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>📸 Instagram Graph API - Minimal Test Server</h1>
          <p>Testing OAuth flow and data fetching for Instagram Professional accounts</p>

          <h2>🚀 Available Endpoints:</h2>

          <div class="endpoint">
            <span class="method">GET</span>
            <strong><a href="/api/instagram/auth">/api/instagram/auth</a></strong>
            <p>Start OAuth flow - redirects to Instagram login</p>
          </div>

          <div class="endpoint">
            <span class="method">GET</span>
            <strong>/api/instagram/callback</strong>
            <p>OAuth callback - handles Instagram redirect (automatic)</p>
          </div>

          <div class="endpoint">
            <span class="method">GET</span>
            <strong>/api/instagram/profile?token=YOUR_TOKEN</strong>
            <p>Get profile data (pic, name, bio, followers, etc.)</p>
          </div>

          <div class="endpoint">
            <span class="method">GET</span>
            <strong>/api/instagram/media?token=YOUR_TOKEN</strong>
            <p>Get all media (posts and reels)</p>
          </div>

          <h2>🧪 How to Test:</h2>
          <ol>
            <li>Click <a href="/api/instagram/auth"><strong>Start OAuth Flow</strong></a></li>
            <li>Log in with your Instagram Professional account</li>
            <li>Copy the access token from the success page</li>
            <li>Use the token to test profile and media endpoints</li>
          </ol>

          <p><small>Server is running in <strong>${process.env.NODE_ENV || 'development'}</strong> mode</small></p>
        </div>
      </body>
    </html>
  `);
});

// Error handler
app.use((err, req, res, next) => {
    console.error('💥 Server error:', err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Start server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`\n🚀 Instagram Graph API Test Server`);
    console.log(`📍 Running on: http://localhost:${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL}`);
    console.log(`\n✨ Start testing: http://localhost:${PORT}/api/instagram/auth\n`);
});

module.exports = app;
