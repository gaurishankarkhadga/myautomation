const axios = require('axios');
const instagramConfig = require('../config/instagram');

class InstagramOAuthService {
    /**
     * Generate Instagram OAuth authorization URL
     */
    getAuthorizationUrl() {
        const params = new URLSearchParams({
            client_id: instagramConfig.appId,
            redirect_uri: instagramConfig.redirectUri,
            scope: instagramConfig.scopes.join(','),
            response_type: 'code'
        });

        return `${instagramConfig.oauthBaseUrl}/authorize?${params.toString()}`;
    }

    /**
     * Exchange authorization code for access token
     */
    async exchangeCodeForToken(code) {
        try {
            const response = await axios.post(`${instagramConfig.oauthBaseUrl}/access_token`, {
                client_id: instagramConfig.appId,
                client_secret: instagramConfig.appSecret,
                grant_type: 'authorization_code',
                redirect_uri: instagramConfig.redirectUri,
                code
            }, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            return {
                accessToken: response.data.access_token,
                userId: response.data.user_id
            };
        } catch (error) {
            console.error('Token exchange error:', error.response?.data || error.message);
            throw new Error('Failed to exchange authorization code for access token');
        }
    }

    /**
     * Exchange short-lived token for long-lived token (60 days)
     */
    async getLongLivedToken(shortLivedToken) {
        try {
            const params = new URLSearchParams({
                grant_type: 'ig_exchange_token',
                client_secret: instagramConfig.appSecret,
                access_token: shortLivedToken
            });

            const response = await axios.get(
                `${instagramConfig.graphBaseUrl}/${instagramConfig.apiVersion}/oauth/access_token?${params.toString()}`
            );

            return {
                accessToken: response.data.access_token,
                expiresIn: response.data.expires_in // seconds
            };
        } catch (error) {
            console.error('Long-lived token error:', error.response?.data || error.message);
            throw new Error('Failed to get long-lived access token');
        }
    }

    /**
     * Refresh a long-lived access token before it expires
     */
    async refreshAccessToken(currentToken) {
        try {
            const params = new URLSearchParams({
                grant_type: 'ig_refresh_token',
                access_token: currentToken
            });

            const response = await axios.get(
                `${instagramConfig.graphBaseUrl}/${instagramConfig.apiVersion}/refresh_access_token?${params.toString()}`
            );

            return {
                accessToken: response.data.access_token,
                expiresIn: response.data.expires_in
            };
        } catch (error) {
            console.error('Token refresh error:', error.response?.data || error.message);
            throw new Error('Failed to refresh access token');
        }
    }

    /**
     * Revoke access token (disconnect)
     */
    async revokeToken(accessToken) {
        try {
            await axios.delete(
                `${instagramConfig.graphBaseUrl}/${instagramConfig.apiVersion}/me/permissions`,
                {
                    params: { access_token: accessToken }
                }
            );
            return true;
        } catch (error) {
            console.error('Token revoke error:', error.response?.data || error.message);
            return false;
        }
    }
}

module.exports = new InstagramOAuthService();
