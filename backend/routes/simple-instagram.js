const express = require('express');
const router = express.Router();
const axios = require('axios');

// Environment variables
const CLIENT_ID = process.env.FACEBOOK_APP_ID;
const CLIENT_SECRET = process.env.FACEBOOK_APP_SECRET;
const REDIRECT_URI = process.env.INSTAGRAM_REDIRECT_URI || 'http://localhost:5000/api/instagram/callback';

// Step 1: Redirect to Instagram OAuth
router.get('/auth', (req, res) => {
    const authUrl = `https://api.instagram.com/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=user_profile,user_media&response_type=code`;
    res.redirect(authUrl);
});

// Step 2: Handle OAuth callback
router.get('/callback', async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.redirect('http://localhost:5173?error=No authorization code');
    }

    try {
        // Exchange code for access token
        const tokenResponse = await axios.post('https://api.instagram.com/oauth/access_token',
            new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: 'authorization_code',
                redirect_uri: REDIRECT_URI,
                code: code
            }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        const { access_token, user_id } = tokenResponse.data;

        // Get long-lived token
        const longLivedTokenResponse = await axios.get('https://graph.instagram.com/access_token', {
            params: {
                grant_type: 'ig_exchange_token',
                client_secret: CLIENT_SECRET,
                access_token: access_token
            }
        });

        const longLivedToken = longLivedTokenResponse.data.access_token;

        // Redirect to frontend with token
        res.redirect(`http://localhost:5173?access_token=${longLivedToken}&user_id=${user_id}`);
    } catch (error) {
        console.error('OAuth Error:', error.response?.data || error.message);
        res.redirect(`http://localhost:5173?error=${encodeURIComponent(error.response?.data?.error_message || error.message)}`);
    }
});

// Step 3: Get Instagram profile data
router.get('/profile', async (req, res) => {
    const { access_token, user_id } = req.query;

    if (!access_token || !user_id) {
        return res.status(400).json({ error: 'Missing access_token or user_id' });
    }

    try {
        // Fetch user profile
        const profileResponse = await axios.get(`https://graph.instagram.com/${user_id}`, {
            params: {
                fields: 'id,username,account_type,media_count',
                access_token: access_token
            }
        });

        // Fetch media (if business account)
        let media = [];
        try {
            const mediaResponse = await axios.get(`https://graph.instagram.com/${user_id}/media`, {
                params: {
                    fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp',
                    access_token: access_token,
                    limit: 10
                }
            });
            media = mediaResponse.data.data || [];
        } catch (mediaError) {
            console.log('Media fetch failed (might not be business account):', mediaError.response?.data);
        }

        res.json({
            success: true,
            profile: profileResponse.data,
            media: media,
            message: 'Instagram API is working! ✅'
        });
    } catch (error) {
        console.error('Profile fetch error:', error.response?.data || error.message);
        res.status(500).json({
            error: error.response?.data?.error?.message || error.message,
            details: error.response?.data
        });
    }
});

module.exports = router;
