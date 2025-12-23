const InstagramAccount = require('../models/InstagramAccount');
const InstagramOAuthService = require('../services/InstagramOAuthService');
const InstagramAPIService = require('../services/InstagramAPIService');

exports.initiateAuth = async (req, res) => {
    try {
        const authUrl = InstagramOAuthService.getAuthorizationUrl();
        res.json({ success: true, authUrl });
    } catch (error) {
        console.error('Initiate auth error:', error);
        res.status(500).json({ error: 'Failed to initiate Instagram authentication' });
    }
};

exports.handleCallback = async (req, res) => {
    try {
        const { code } = req.query;
        const userId = req.userId;

        if (!code) {
            return res.status(400).json({ error: 'Authorization code not provided' });
        }

        // Step 1: Exchange code for short-lived token
        const { accessToken: shortToken, userId: instagramUserId } =
            await InstagramOAuthService.exchangeCodeForToken(code);

        // Step 2: Get long-lived token
        const { accessToken, expiresIn } =
            await InstagramOAuthService.getLongLivedToken(shortToken);

        // Step 3: Fetch user profile
        const profile = await InstagramAPIService.getUserProfile(accessToken);

        // Step 4: Save or update Instagram account
        const tokenExpiry = new Date(Date.now() + expiresIn * 1000);

        let instagramAccount = await InstagramAccount.findOne({ userId });

        if (instagramAccount) {
            // Update existing
            instagramAccount.instagramUserId = profile.id;
            instagramAccount.username = profile.username;
            instagramAccount.accessToken = accessToken;
            instagramAccount.tokenExpiry = tokenExpiry;
            instagramAccount.accountType = profile.account_type;
            instagramAccount.profilePictureUrl = profile.profile_picture_url;
            instagramAccount.followersCount = profile.followers_count;
            instagramAccount.followsCount = profile.follows_count;
            instagramAccount.mediaCount = profile.media_count;
            instagramAccount.biography = profile.biography;
            instagramAccount.website = profile.website;
            instagramAccount.isConnected = true;
            instagramAccount.lastSynced = new Date();
        } else {
            // Create new
            instagramAccount = new InstagramAccount({
                userId,
                instagramUserId: profile.id,
                username: profile.username,
                accessToken,
                tokenExpiry,
                accountType: profile.account_type,
                profilePictureUrl: profile.profile_picture_url,
                followersCount: profile.followers_count,
                followsCount: profile.follows_count,
                mediaCount: profile.media_count,
                biography: profile.biography,
                website: profile.website
            });
        }

        await instagramAccount.save();

        // Redirect to frontend success page
        res.redirect(`${process.env.FRONTEND_URL}/instagram-connected?success=true`);
    } catch (error) {
        console.error('Callback error:', error);
        res.redirect(`${process.env.FRONTEND_URL}/instagram-connected?success=false&error=${encodeURIComponent(error.message)}`);
    }
};

exports.getProfile = async (req, res) => {
    try {
        const instagramAccount = await InstagramAccount.findOne({
            userId: req.userId,
            isConnected: true
        });

        if (!instagramAccount) {
            return res.status(404).json({ error: 'Instagram account not connected' });
        }

        // Fetch fresh profile data
        const profile = await InstagramAPIService.getUserProfile(instagramAccount.accessToken);

        // Update database
        instagramAccount.followersCount = profile.followers_count;
        instagramAccount.followsCount = profile.follows_count;
        instagramAccount.mediaCount = profile.media_count;
        instagramAccount.lastSynced = new Date();
        await instagramAccount.save();

        res.json({
            success: true,
            profile: {
                id: profile.id,
                username: profile.username,
                accountType: profile.account_type,
                profilePicture: profile.profile_picture_url,
                biography: profile.biography,
                website: profile.website,
                followersCount: profile.followers_count,
                followingCount: profile.follows_count,
                mediaCount: profile.media_count
            }
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to fetch Instagram profile' });
    }
};

exports.getUserMedia = async (req, res) => {
    try {
        const instagramAccount = await InstagramAccount.findOne({
            userId: req.userId,
            isConnected: true
        });

        if (!instagramAccount) {
            return res.status(404).json({ error: 'Instagram account not connected' });
        }

        const media = await InstagramAPIService.getUserMedia(instagramAccount.accessToken);

        res.json({ success: true, media });
    } catch (error) {
        console.error('Get media error:', error);
        res.status(500).json({ error: 'Failed to fetch Instagram media' });
    }
};

exports.disconnect = async (req, res) => {
    try {
        const instagramAccount = await InstagramAccount.findOne({ userId: req.userId });

        if (!instagramAccount) {
            return res.status(404).json({ error: 'Instagram account not found' });
        }

        // Revoke token
        await InstagramOAuthService.revokeToken(instagramAccount.accessToken);

        // Mark as disconnected
        instagramAccount.isConnected = false;
        await instagramAccount.save();

        res.json({ success: true, message: 'Instagram account disconnected successfully' });
    } catch (error) {
        console.error('Disconnect error:', error);
        res.status(500).json({ error: 'Failed to disconnect Instagram account' });
    }
};
