const Analytics = require('../models/Analytics');
const InstagramAccount = require('../models/InstagramAccount');
const InstagramAPIService = require('../services/InstagramAPIService');

exports.getOverview = async (req, res) => {
    try {
        const instagramAccount = await InstagramAccount.findOne({
            userId: req.userId,
            isConnected: true
        });

        if (!instagramAccount) {
            return res.status(404).json({ error: 'Instagram account not connected' });
        }

        // Get latest analytics
        const latestAnalytics = await Analytics.findOne({
            instagramAccountId: instagramAccount._id
        }).sort({ date: -1 });

        // Get follower growth (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const weekAnalytics = await Analytics.find({
            instagramAccountId: instagramAccount._id,
            date: { $gte: sevenDaysAgo }
        }).sort({ date: 1 });

        res.json({
            success: true,
            overview: {
                currentFollowers: instagramAccount.followersCount,
                totalPosts: instagramAccount.mediaCount,
                latestMetrics: latestAnalytics?.metrics || {},
                weeklyGrowth: weekAnalytics.map(a => ({
                    date: a.date,
                    followers: a.metrics.followerCount
                }))
            }
        });
    } catch (error) {
        console.error('Get overview error:', error);
        res.status(500).json({ error: 'Failed to fetch analytics overview' });
    }
};

exports.syncInsights = async (req, res) => {
    try {
        const instagramAccount = await InstagramAccount.findOne({
            userId: req.userId,
            isConnected: true
        });

        if (!instagramAccount) {
            return res.status(404).json({ error: 'Instagram account not connected' });
        }

        // Fetch insights from Instagram
        const insights = await InstagramAPIService.getAccountInsights(
            instagramAccount.accessToken,
            'day'
        );

        // Parse insights data
        const metrics = {
            impressions: 0,
            reach: 0,
            followerCount: instagramAccount.followersCount,
            profileViews: 0,
            websiteClicks: 0
        };

        insights.forEach(insight => {
            if (insight.name === 'impressions') {
                metrics.impressions = insight.values[0]?.value || 0;
            } else if (insight.name === 'reach') {
                metrics.reach = insight.values[0]?.value || 0;
            } else if (insight.name === 'profile_views') {
                metrics.profileViews = insight.values[0]?.value || 0;
            } else if (insight.name === 'website_clicks') {
                metrics.websiteClicks = insight.values[0]?.value || 0;
            }
        });

        // Get top posts
        const media = await InstagramAPIService.getUserMedia(instagramAccount.accessToken, 10);
        const topPosts = media.slice(0, 5).map(post => ({
            mediaId: post.id,
            mediaUrl: post.media_url || post.thumbnail_url,
            caption: post.caption,
            likes: post.like_count || 0,
            comments: post.comments_count || 0,
            engagement: (post.like_count || 0) + (post.comments_count || 0)
        }));

        // Save analytics
        const analytics = new Analytics({
            instagramAccountId: instagramAccount._id,
            date: new Date(),
            metrics,
            topPosts
        });

        await analytics.save();

        res.json({
            success: true,
            message: 'Insights synced successfully',
            analytics
        });
    } catch (error) {
        console.error('Sync insights error:', error);
        res.status(500).json({ error: 'Failed to sync insights' });
    }
};

exports.getInsights = async (req, res) => {
    try {
        const { days = 30 } = req.query;

        const instagramAccount = await InstagramAccount.findOne({
            userId: req.userId,
            isConnected: true
        });

        if (!instagramAccount) {
            return res.status(404).json({ error: 'Instagram account not connected' });
        }

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));

        const analytics = await Analytics.find({
            instagramAccountId: instagramAccount._id,
            date: { $gte: startDate }
        }).sort({ date: 1 });

        res.json({ success: true, analytics });
    } catch (error) {
        console.error('Get insights error:', error);
        res.status(500).json({ error: 'Failed to fetch insights' });
    }
};
