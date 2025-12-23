const axios = require('axios');
const instagramConfig = require('../config/instagram');

class InstagramAPIService {
    /**
     * Get Instagram user profile
     */
    async getUserProfile(accessToken) {
        try {
            const fields = 'id,username,account_type,media_count,followers_count,follows_count,profile_picture_url,biography,website';

            const response = await axios.get(
                `${instagramConfig.baseUrl}/me`,
                {
                    params: {
                        fields,
                        access_token: accessToken
                    }
                }
            );

            return response.data;
        } catch (error) {
            console.error('Get profile error:', error.response?.data || error.message);
            throw new Error('Failed to fetch Instagram profile');
        }
    }

    /**
     * Get user's media (posts)
     */
    async getUserMedia(accessToken, limit = 25) {
        try {
            const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count';

            const response = await axios.get(
                `${instagramConfig.baseUrl}/me/media`,
                {
                    params: {
                        fields,
                        limit,
                        access_token: accessToken
                    }
                }
            );

            return response.data.data || [];
        } catch (error) {
            console.error('Get media error:', error.response?.data || error.message);
            throw new Error('Failed to fetch Instagram media');
        }
    }

    /**
     * Get insights for a media post
     */
    async getMediaInsights(mediaId, accessToken) {
        try {
            const metrics = 'engagement,impressions,reach,saved';

            const response = await axios.get(
                `${instagramConfig.baseUrl}/${mediaId}/insights`,
                {
                    params: {
                        metric: metrics,
                        access_token: accessToken
                    }
                }
            );

            return response.data.data || [];
        } catch (error) {
            console.error('Get media insights error:', error.response?.data || error.message);
            return [];
        }
    }

    /**
     * Get account insights
     */
    async getAccountInsights(accessToken, period = 'day', metrics = null) {
        try {
            const defaultMetrics = 'impressions,reach,profile_views,website_clicks,follower_count';
            const metricsToFetch = metrics || defaultMetrics;

            const response = await axios.get(
                `${instagramConfig.baseUrl}/me/insights`,
                {
                    params: {
                        metric: metricsToFetch,
                        period,
                        access_token: accessToken
                    }
                }
            );

            return response.data.data || [];
        } catch (error) {
            console.error('Get account insights error:', error.response?.data || error.message);
            return [];
        }
    }

    /**
     * Create media container for publishing (Step 1 of publishing)
     */
    async createMediaContainer(instagramUserId, accessToken, mediaData) {
        try {
            const { imageUrl, videoUrl, caption, mediaType = 'IMAGE' } = mediaData;

            const params = {
                access_token: accessToken,
                caption: caption || ''
            };

            if (mediaType === 'IMAGE') {
                params.image_url = imageUrl;
            } else if (mediaType === 'VIDEO') {
                params.media_type = 'VIDEO';
                params.video_url = videoUrl;
            }

            const response = await axios.post(
                `${instagramConfig.baseUrl}/${instagramUserId}/media`,
                null,
                { params }
            );

            return response.data.id; // Returns creation_id
        } catch (error) {
            console.error('Create container error:', error.response?.data || error.message);
            throw new Error('Failed to create media container');
        }
    }

    /**
     * Publish media container (Step 2 of publishing)
     */
    async publishMediaContainer(instagramUserId, accessToken, creationId) {
        try {
            const response = await axios.post(
                `${instagramConfig.baseUrl}/${instagramUserId}/media_publish`,
                null,
                {
                    params: {
                        creation_id: creationId,
                        access_token: accessToken
                    }
                }
            );

            return response.data.id; // Returns published media ID
        } catch (error) {
            console.error('Publish media error:', error.response?.data || error.message);
            throw new Error('Failed to publish media');
        }
    }

    /**
     * Complete publish flow (create + publish)
     */
    async publishPost(instagramUserId, accessToken, mediaData) {
        try {
            // Step 1: Create container
            const creationId = await this.createMediaContainer(instagramUserId, accessToken, mediaData);

            // Wait a bit for media processing
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Step 2: Publish
            const mediaId = await this.publishMediaContainer(instagramUserId, accessToken, creationId);

            return {
                success: true,
                mediaId,
                creationId
            };
        } catch (error) {
            console.error('Publish post error:', error.message);
            throw error;
        }
    }
}

module.exports = new InstagramAPIService();
