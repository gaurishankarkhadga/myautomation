const cron = require('node-cron');
const ScheduledPost = require('../models/ScheduledPost');
const InstagramAccount = require('../models/InstagramAccount');
const InstagramAPIService = require('../services/InstagramAPIService');

// Run every minute to check for posts to publish
cron.schedule('* * * * *', async () => {
    try {
        const now = new Date();

        // Find posts scheduled for now or past
        const postsToPublish = await ScheduledPost.find({
            status: 'PENDING',
            scheduledTime: { $lte: now }
        }).limit(10);

        if (postsToPublish.length === 0) {
            return;
        }

        console.log(`📋 Found ${postsToPublish.length} posts to publish`);

        for (const post of postsToPublish) {
            try {
                // Get Instagram account
                const instagramAccount = await InstagramAccount.findById(post.instagramAccountId);

                if (!instagramAccount || !instagramAccount.isConnected) {
                    post.status = 'FAILED';
                    post.errorMessage = 'Instagram account not connected';
                    await post.save();
                    continue;
                }

                // Publish post
                console.log(`📤 Publishing post: ${post._id}`);

                const result = await InstagramAPIService.publishPost(
                    instagramAccount.instagramUserId,
                    instagramAccount.accessToken,
                    {
                        imageUrl: post.mediaUrl,
                        videoUrl: post.mediaType === 'VIDEO' ? post.mediaUrl : null,
                        caption: post.caption,
                        mediaType: post.mediaType
                    }
                );

                // Update post status
                post.status = 'PUBLISHED';
                post.publishedAt = new Date();
                post.instagramPostId = result.mediaId;
                await post.save();

                console.log(`✅ Post published successfully: ${result.mediaId}`);
            } catch (error) {
                console.error(`❌ Failed to publish post ${post._id}:`, error.message);

                // Mark as failed
                post.status = 'FAILED';
                post.errorMessage = error.message;
                await post.save();
            }
        }
    } catch (error) {
        console.error('Scheduled post job error:', error);
    }
});

console.log('⏰ Scheduled post publisher started (runs every minute)');
