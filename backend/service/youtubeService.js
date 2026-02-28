const { google } = require('googleapis');

// YouTube API Configuration
const YOUTUBE_CONFIG = {
    clientId: process.env.Google_Client_Id,
    clientSecret: process.env.Google_Client_Secret,
    redirectUri: process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:8000/api/youtube/callback',
    apiKey: process.env.Youtube_Api_Key,
    scopes: [
        'https://www.googleapis.com/auth/youtube.readonly',
        'https://www.googleapis.com/auth/youtube.force-ssl',
        'https://www.googleapis.com/auth/userinfo.profile'
    ]
};

/**
 * Create a new OAuth2 client
 */
function createOAuth2Client() {
    return new google.auth.OAuth2(
        YOUTUBE_CONFIG.clientId,
        YOUTUBE_CONFIG.clientSecret,
        YOUTUBE_CONFIG.redirectUri
    );
}

/**
 * Generate Google OAuth consent URL
 */
function getAuthUrl() {
    const oauth2Client = createOAuth2Client();
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: YOUTUBE_CONFIG.scopes,
        prompt: 'consent',
        include_granted_scopes: true
    });
}

/**
 * Exchange authorization code for tokens
 */
async function getTokens(code) {
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    console.log('[YouTube] Tokens received:', {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        expiryDate: tokens.expiry_date
    });
    return tokens;
}

/**
 * Create an authenticated OAuth2 client from stored tokens
 */
function createAuthClient(accessToken, refreshToken, expiresAt) {
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
        expiry_date: new Date(expiresAt).getTime()
    });
    return oauth2Client;
}

/**
 * Refresh access token if expired
 */
async function refreshAccessToken(refreshToken) {
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await oauth2Client.refreshAccessToken();
    console.log('[YouTube] Token refreshed, new expiry:', new Date(credentials.expiry_date));
    return credentials;
}

/**
 * Get channel information for authenticated user
 */
async function getChannelInfo(authClient) {
    const youtube = google.youtube({ version: 'v3', auth: authClient });

    const response = await youtube.channels.list({
        part: 'snippet,statistics,contentDetails',
        mine: true
    });

    const channel = response.data.items?.[0];
    if (!channel) {
        throw new Error('No channel found for this account');
    }

    return {
        id: channel.id,
        title: channel.snippet.title,
        description: channel.snippet.description,
        customUrl: channel.snippet.customUrl,
        thumbnailUrl: channel.snippet.thumbnails?.high?.url || channel.snippet.thumbnails?.default?.url,
        subscriberCount: channel.statistics.subscriberCount,
        videoCount: channel.statistics.videoCount,
        viewCount: channel.statistics.viewCount,
        uploadsPlaylistId: channel.contentDetails.relatedPlaylists.uploads
    };
}

/**
 * Get recent videos for a channel
 */
async function getVideos(authClient, channelId, maxResults = 12) {
    const youtube = google.youtube({ version: 'v3', auth: authClient });

    // First get video IDs from search
    const searchResponse = await youtube.search.list({
        part: 'id,snippet',
        channelId: channelId,
        maxResults: maxResults,
        order: 'date',
        type: 'video'
    });

    const videoIds = searchResponse.data.items.map(item => item.id.videoId).filter(Boolean);

    if (videoIds.length === 0) {
        return [];
    }

    // Get detailed stats for each video
    const videoResponse = await youtube.videos.list({
        part: 'snippet,statistics,contentDetails',
        id: videoIds.join(',')
    });

    return videoResponse.data.items.map(video => ({
        id: video.id,
        title: video.snippet.title,
        description: video.snippet.description?.substring(0, 200),
        thumbnailUrl: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.medium?.url || video.snippet.thumbnails?.default?.url,
        publishedAt: video.snippet.publishedAt,
        viewCount: video.statistics.viewCount || '0',
        likeCount: video.statistics.likeCount || '0',
        commentCount: video.statistics.commentCount || '0',
        duration: video.contentDetails.duration
    }));
}

/**
 * Get comments for a specific video
 */
async function getComments(authClient, videoId, maxResults = 50) {
    const youtube = google.youtube({ version: 'v3', auth: authClient });

    const response = await youtube.commentThreads.list({
        part: 'snippet,replies',
        videoId: videoId,
        maxResults: maxResults,
        order: 'time',
        textFormat: 'plainText'
    });

    return response.data.items.map(thread => {
        const comment = thread.snippet.topLevelComment;
        const replies = thread.replies?.comments || [];

        return {
            commentId: comment.id,
            videoId: videoId,
            authorName: comment.snippet.authorDisplayName,
            authorProfileUrl: comment.snippet.authorProfileImageUrl,
            authorChannelId: comment.snippet.authorChannelId?.value,
            text: comment.snippet.textDisplay,
            likeCount: comment.snippet.likeCount,
            publishedAt: comment.snippet.publishedAt,
            updatedAt: comment.snippet.updatedAt,
            totalReplyCount: thread.snippet.totalReplyCount,
            replies: replies.map(r => ({
                commentId: r.id,
                authorName: r.snippet.authorDisplayName,
                authorChannelId: r.snippet.authorChannelId?.value,
                text: r.snippet.textDisplay,
                publishedAt: r.snippet.publishedAt
            }))
        };
    });
}

/**
 * Reply to a YouTube comment
 */
async function replyToComment(authClient, parentId, text) {
    const youtube = google.youtube({ version: 'v3', auth: authClient });

    try {
        console.log('[YouTube] Replying to comment:', parentId);

        const response = await youtube.comments.insert({
            part: 'snippet',
            requestBody: {
                snippet: {
                    parentId: parentId,
                    textOriginal: text
                }
            }
        });

        console.log('[YouTube] Reply sent successfully. Reply ID:', response.data.id);
        return { success: true, replyId: response.data.id };
    } catch (error) {
        const errorMsg = error.response?.data?.error?.message || error.message;
        console.error('[YouTube] Failed to reply:', errorMsg);
        return { success: false, error: errorMsg };
    }
}

/**
 * Moderate a YouTube comment (hold for review or reject)
 */
async function moderateComment(authClient, commentId, moderationAction) {
    const youtube = google.youtube({ version: 'v3', auth: authClient });

    try {
        console.log(`[YouTube] Moderating comment ${commentId}: ${moderationAction}`);

        // Valid statuses: 'heldForReview', 'published', 'rejected'
        await youtube.comments.setModerationStatus({
            id: commentId,
            moderationStatus: moderationAction,
            banAuthor: false
        });

        console.log(`[YouTube] Comment moderated successfully: ${commentId}`);
        return { success: true };
    } catch (error) {
        const errorMsg = error.response?.data?.error?.message || error.message;
        console.error('[YouTube] Failed to moderate comment:', errorMsg);
        return { success: false, error: errorMsg };
    }
}

/**
 * Delete a YouTube comment
 */
async function deleteComment(authClient, commentId) {
    const youtube = google.youtube({ version: 'v3', auth: authClient });

    try {
        console.log('[YouTube] Deleting comment:', commentId);

        await youtube.comments.delete({
            id: commentId
        });

        console.log('[YouTube] Comment deleted successfully:', commentId);
        return { success: true };
    } catch (error) {
        const errorMsg = error.response?.data?.error?.message || error.message;
        console.error('[YouTube] Failed to delete comment:', errorMsg);
        return { success: false, error: errorMsg };
    }
}

/**
 * Get all new (unprocessed) comments across recent videos
 */
async function getNewComments(authClient, channelId, processedCommentIds) {
    const youtube = google.youtube({ version: 'v3', auth: authClient });

    try {
        // Get comments on all videos for this channel (most recent first)
        const response = await youtube.commentThreads.list({
            part: 'snippet',
            allThreadsRelatedToChannelId: channelId,
            maxResults: 50,
            order: 'time',
            moderationStatus: 'published',
            textFormat: 'plainText'
        });

        const newComments = [];

        for (const thread of (response.data.items || [])) {
            const comment = thread.snippet.topLevelComment;
            const commentId = comment.id;

            // Skip already processed comments
            if (processedCommentIds.has(commentId)) {
                continue;
            }

            // Skip own comments (don't reply to yourself)
            if (comment.snippet.authorChannelId?.value === channelId) {
                continue;
            }

            newComments.push({
                commentId: commentId,
                videoId: comment.snippet.videoId,
                text: comment.snippet.textDisplay,
                authorName: comment.snippet.authorDisplayName,
                authorChannelId: comment.snippet.authorChannelId?.value,
                publishedAt: comment.snippet.publishedAt
            });
        }

        console.log(`[YouTube] Found ${newComments.length} new comments out of ${response.data.items?.length || 0} total`);
        return newComments;
    } catch (error) {
        console.error('[YouTube] Failed to fetch new comments:', error.message);
        return [];
    }
}

module.exports = {
    YOUTUBE_CONFIG,
    createOAuth2Client,
    getAuthUrl,
    getTokens,
    createAuthClient,
    refreshAccessToken,
    getChannelInfo,
    getVideos,
    getComments,
    replyToComment,
    moderateComment,
    deleteComment,
    getNewComments
};
