require('dotenv').config();

module.exports = {
    appId: process.env.INSTAGRAM_APP_ID,
    appSecret: process.env.INSTAGRAM_APP_SECRET,
    redirectUri: process.env.INSTAGRAM_REDIRECT_URI,
    apiVersion: process.env.INSTAGRAM_GRAPH_API_VERSION || 'v18.0',
    baseUrl: process.env.INSTAGRAM_GRAPH_API_BASE_URL || 'https://graph.instagram.com',
    oauthBaseUrl: 'https://api.instagram.com/oauth',
    graphBaseUrl: 'https://graph.facebook.com',
    scopes: ['instagram_basic', 'instagram_content_publish', 'instagram_manage_insights', 'pages_show_list', 'pages_read_engagement'],
    tokenExpiry: 60 * 24 * 60 * 60 * 1000 // 60 days in milliseconds
};
