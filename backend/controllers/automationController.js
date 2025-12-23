const ScheduledPost = require('../models/ScheduledPost');
const InstagramAccount = require('../models/InstagramAccount');
const InstagramAPIService = require('../services/InstagramAPIService');

exports.createScheduledPost = async (req, res) => {
    try {
        const { caption, mediaUrl, mediaType, scheduledTime } = req.body;
        const userId = req.userId;

        // Get Instagram account
        const instagramAccount = await InstagramAccount.findOne({ userId, isConnected: true });
        if (!instagramAccount) {
            return res.status(404).json({ error: 'Instagram account not connected' });
        }

        // Create scheduled post
        const scheduledPost = new ScheduledPost({
            userId,
            instagramAccountId: instagramAccount._id,
            caption,
            mediaUrl,
            mediaType: mediaType || 'IMAGE',
            scheduledTime: new Date(scheduledTime),
            status: 'PENDING'
        });

        await scheduledPost.save();

        res.status(201).json({
            success: true,
            scheduledPost: {
                id: scheduledPost._id,
                caption: scheduledPost.caption,
                mediaUrl: scheduledPost.mediaUrl,
                mediaType: scheduledPost.mediaType,
                scheduledTime: scheduledPost.scheduledTime,
                status: scheduledPost.status
            }
        });
    } catch (error) {
        console.error('Create scheduled post error:', error);
        res.status(500).json({ error: 'Failed to create scheduled post' });
    }
};

exports.getScheduledPosts = async (req, res) => {
    try {
        const scheduledPosts = await ScheduledPost.find({ userId: req.userId })
            .sort({ scheduledTime: 1 });

        res.json({ success: true, scheduledPosts });
    } catch (error) {
        console.error('Get scheduled posts error:', error);
        res.status(500).json({ error: 'Failed to fetch scheduled posts' });
    }
};

exports.updateScheduledPost = async (req, res) => {
    try {
        const { id } = req.params;
        const { caption, mediaUrl, scheduledTime } = req.body;

        const scheduledPost = await ScheduledPost.findOne({
            _id: id,
            userId: req.userId,
            status: 'PENDING'
        });

        if (!scheduledPost) {
            return res.status(404).json({ error: 'Scheduled post not found or already published' });
        }

        if (caption) scheduledPost.caption = caption;
        if (mediaUrl) scheduledPost.mediaUrl = mediaUrl;
        if (scheduledTime) scheduledPost.scheduledTime = new Date(scheduledTime);

        await scheduledPost.save();

        res.json({ success: true, scheduledPost });
    } catch (error) {
        console.error('Update scheduled post error:', error);
        res.status(500).json({ error: 'Failed to update scheduled post' });
    }
};

exports.deleteScheduledPost = async (req, res) => {
    try {
        const { id } = req.params;

        const scheduledPost = await ScheduledPost.findOne({
            _id: id,
            userId: req.userId
        });

        if (!scheduledPost) {
            return res.status(404).json({ error: 'Scheduled post not found' });
        }

        if (scheduledPost.status === 'PUBLISHED') {
            return res.status(400).json({ error: 'Cannot delete already published post' });
        }

        scheduledPost.status = 'CANCELLED';
        await scheduledPost.save();

        res.json({ success: true, message: 'Scheduled post cancelled' });
    } catch (error) {
        console.error('Delete scheduled post error:', error);
        res.status(500).json({ error: 'Failed to delete scheduled post' });
    }
};

exports.publishNow = async (req, res) => {
    try {
        const { id } = req.params;

        const scheduledPost = await ScheduledPost.findOne({
            _id: id,
            userId: req.userId,
            status: 'PENDING'
        });

        if (!scheduledPost) {
            return res.status(404).json({ error: 'Scheduled post not found' });
        }

        const instagramAccount = await InstagramAccount.findById(scheduledPost.instagramAccountId);

        // Publish post
        const result = await InstagramAPIService.publishPost(
            instagramAccount.instagramUserId,
            instagramAccount.accessToken,
            {
                imageUrl: scheduledPost.mediaUrl,
                caption: scheduledPost.caption,
                mediaType: scheduledPost.mediaType
            }
        );

        // Update post status
        scheduledPost.status = 'PUBLISHED';
        scheduledPost.publishedAt = new Date();
        scheduledPost.instagramPostId = result.mediaId;
        await scheduledPost.save();

        res.json({
            success: true,
            message: 'Post published successfully',
            instagramPostId: result.mediaId
        });
    } catch (error) {
        console.error('Publish now error:', error);

        // Update post with error
        const scheduledPost = await ScheduledPost.findById(req.params.id);
        if (scheduledPost) {
            scheduledPost.status = 'FAILED';
            scheduledPost.errorMessage = error.message;
            await scheduledPost.save();
        }

        res.status(500).json({ error: 'Failed to publish post: ' + error.message });
    }
};
