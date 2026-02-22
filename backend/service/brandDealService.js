const { GoogleGenerativeAI } = require("@google/generative-ai");
const Campaign = require('../model/Campaign');
const DealApplication = require('../model/DealApplication');
const axios = require('axios');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const GRAPH_BASE = `${process.env.INSTAGRAM_GRAPH_API_BASE_URL || 'https://graph.instagram.com'}/v${process.env.INSTAGRAM_GRAPH_API_VERSION || '24.0'}`;


// ==================== HELPERS ====================

function cleanJsonString(input) {
    if (!input) return "{}";
    let cleaned = input.trim();
    if (cleaned.startsWith("```json")) cleaned = cleaned.replace(/^```json/, "").replace(/```$/, "");
    else if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```/, "").replace(/```$/, "");
    return cleaned.trim();
}

function getFollowerTier(followers) {
    if (followers < 10000) return 'nano';
    if (followers < 50000) return 'micro';
    if (followers < 100000) return 'mid';
    if (followers < 500000) return 'macro';
    return 'mega';
}

function extractHashtags(caption) {
    if (!caption) return [];
    const matches = caption.match(/#\w+/g);
    return matches ? matches.map(h => h.toLowerCase()) : [];
}


// ==================== COLLECT CREATOR DATA ====================

async function collectCreatorData(userId, accessToken) {
    console.log(`[Marketplace] Collecting creator data for: ${userId}`);

    const profileRes = await axios.get(`${GRAPH_BASE}/${userId}`, {
        params: {
            fields: 'id,username,name,biography,followers_count,media_count,profile_picture_url',
            access_token: accessToken
        }
    });
    const profile = profileRes.data;

    const mediaRes = await axios.get(`${GRAPH_BASE}/${userId}/media`, {
        params: {
            fields: 'id,caption,media_type,timestamp,like_count,comments_count,permalink,media_url,thumbnail_url',
            limit: 25,
            access_token: accessToken
        }
    });
    const posts = mediaRes.data.data || [];

    let totalLikes = 0, totalComments = 0;
    let images = 0, videos = 0, carousels = 0, reels = 0;
    const allHashtags = [];
    const allCaptions = [];

    for (const post of posts) {
        totalLikes += post.like_count || 0;
        totalComments += post.comments_count || 0;
        if (post.caption) {
            allCaptions.push(post.caption);
            allHashtags.push(...extractHashtags(post.caption));
        }
        switch (post.media_type) {
            case 'IMAGE': images++; break;
            case 'VIDEO': videos++; reels++; break;
            case 'CAROUSEL_ALBUM': carousels++; break;
        }
    }

    const postCount = posts.length || 1;
    const avgLikes = Math.round(totalLikes / postCount);
    const avgComments = Math.round(totalComments / postCount);
    const engagementRate = profile.followers_count > 0
        ? parseFloat(((avgLikes + avgComments) / profile.followers_count * 100).toFixed(2))
        : 0;

    const hashtagCount = {};
    allHashtags.forEach(h => { hashtagCount[h] = (hashtagCount[h] || 0) + 1; });
    const topHashtags = Object.entries(hashtagCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag]) => tag);

    // Top performing posts for showcase
    const topPosts = [...posts]
        .sort((a, b) => ((b.like_count || 0) + (b.comments_count || 0)) - ((a.like_count || 0) + (a.comments_count || 0)))
        .slice(0, 6)
        .map(p => ({
            postId: p.id,
            caption: (p.caption || '').substring(0, 120),
            likes: p.like_count || 0,
            comments: p.comments_count || 0,
            mediaType: p.media_type,
            permalink: p.permalink
        }));

    // Detect niche via AI
    let niche = 'lifestyle';
    try {
        const nichePrompt = `Analyze these Instagram captions and hashtags. Return ONLY a single word or two-word phrase for the primary niche (e.g., "fitness", "fashion", "tech", "food", "beauty", "travel", "gaming").

CAPTIONS: ${allCaptions.slice(0, 10).join(' | ').substring(0, 2000)}
HASHTAGS: ${topHashtags.join(', ')}
BIO: ${profile.biography || ''}

Return ONLY the niche word(s), nothing else.`;

        const nicheResult = await model.generateContent(nichePrompt);
        niche = nicheResult.response.text().trim().toLowerCase().replace(/[^a-z\s]/g, '').substring(0, 30) || 'lifestyle';
    } catch (e) {
        console.error('[Marketplace] Niche detection failed, using fallback:', e.message);
    }

    return {
        username: profile.username,
        name: profile.name,
        bio: profile.biography || '',
        followers: profile.followers_count,
        mediaCount: profile.media_count,
        avgLikes,
        avgComments,
        engagementRate,
        niche,
        followerTier: getFollowerTier(profile.followers_count),
        topHashtags,
        contentMix: { images, videos, carousels, reels },
        topPosts,
        captions: allCaptions.slice(0, 10)
    };
}


// ==================== AI MATCH SCORE ====================

async function calculateMatchScore(campaign, creatorData) {
    console.log(`[Marketplace] Calculating match: ${creatorData.username} ↔ ${campaign.brandName}`);

    try {
        const prompt = `You are evaluating how well a creator matches a brand campaign.

CAMPAIGN:
- Brand: ${campaign.brandName}
- Title: ${campaign.title}
- Niche Required: ${campaign.targetNiche}
- Sub-niches: ${(campaign.targetSubNiches || []).join(', ')}
- Min Followers: ${campaign.minFollowers}
- Max Followers: ${campaign.maxFollowers}
- Requirements: ${campaign.requirements}
- Description: ${campaign.description}

CREATOR:
- @${creatorData.username}
- Niche: ${creatorData.niche}
- Followers: ${creatorData.followers} (${creatorData.followerTier} tier)
- Engagement: ${creatorData.engagementRate}%
- Avg Likes: ${creatorData.avgLikes} | Avg Comments: ${creatorData.avgComments}
- Bio: ${creatorData.bio}
- Top Hashtags: ${creatorData.topHashtags.join(', ')}

Score the match 0-100 and give 3-4 specific reasons. Consider:
1. Niche alignment (most important)
2. Follower count within range
3. Engagement rate quality
4. Content style fit

Return ONLY JSON:
{"score": 85, "reasons": ["Reason 1", "Reason 2", "Reason 3"]}`;

        const result = await model.generateContent(prompt);
        const parsed = JSON.parse(cleanJsonString(result.response.text()));
        return {
            score: Math.min(100, Math.max(0, parseInt(parsed.score) || 50)),
            reasons: parsed.reasons || ['Niche alignment evaluated']
        };
    } catch (e) {
        console.error('[Marketplace] Match scoring error:', e.message);
        // Fallback: calculate basic score
        let score = 50;
        const reasons = [];

        if (creatorData.niche.includes(campaign.targetNiche.toLowerCase()) ||
            campaign.targetNiche.toLowerCase().includes(creatorData.niche)) {
            score += 20;
            reasons.push(`Niche match: ${creatorData.niche}`);
        }
        if (creatorData.followers >= campaign.minFollowers && creatorData.followers <= campaign.maxFollowers) {
            score += 15;
            reasons.push(`Follower count in range`);
        }
        if (creatorData.engagementRate > 3) {
            score += 10;
            reasons.push(`Good engagement rate: ${creatorData.engagementRate}%`);
        }
        return { score: Math.min(100, score), reasons };
    }
}


// ==================== PITCH GENERATION ====================

async function generateApplicationPitch(campaign, creatorData) {
    console.log(`[Marketplace] Generating pitch: ${creatorData.username} → ${campaign.brandName}`);

    try {
        const prompt = `Write a professional collaboration pitch email from a creator to a brand.

CREATOR:
- @${creatorData.username} | ${creatorData.niche} creator
- ${creatorData.followers.toLocaleString()} followers (${creatorData.followerTier} tier)
- ${creatorData.engagementRate}% engagement | Avg ${creatorData.avgLikes} likes
- Bio: ${creatorData.bio}

CAMPAIGN:
- Brand: ${campaign.brandName}
- Title: ${campaign.title}
- Description: ${campaign.description}
- Deliverables: ${campaign.deliverables}
- Compensation: ${campaign.compensationType} ($${campaign.budgetMin}-$${campaign.budgetMax} ${campaign.currency})

Requirements:
1. Subject line — catchy, specific to the brand
2. Body — introduce yourself, explain why you're a perfect fit, reference the specific campaign, propose a content idea, include your stats, and close with a call-to-action
3. Keep it under 180 words, warm but professional
4. Sound like a real creator, not corporate

Return ONLY JSON:
{"subject": "Subject line", "body": "Full email body"}`;

        const result = await model.generateContent(prompt);
        return JSON.parse(cleanJsonString(result.response.text()));
    } catch (e) {
        console.error('[Marketplace] Pitch generation error:', e.message);
        return {
            subject: `Collaboration Opportunity — @${creatorData.username} x ${campaign.brandName}`,
            body: `Hi ${campaign.brandName} team,\n\nI'm @${creatorData.username}, a ${creatorData.niche} creator with ${creatorData.followers.toLocaleString()} followers and ${creatorData.engagementRate}% engagement rate.\n\nI'd love to collaborate on your "${campaign.title}" campaign. My audience aligns well with your brand, and I have experience creating engaging ${creatorData.niche} content.\n\nI'd be happy to discuss content ideas and deliverables.\n\nBest,\n@${creatorData.username}`
        };
    }
}


// ==================== MEDIA KIT BUILDER ====================

function buildMediaKit(creatorData) {
    return {
        username: creatorData.username,
        followers: creatorData.followers,
        engagementRate: creatorData.engagementRate,
        avgLikes: creatorData.avgLikes,
        avgComments: creatorData.avgComments,
        niche: creatorData.niche,
        followerTier: creatorData.followerTier,
        bio: creatorData.bio,
        topHashtags: creatorData.topHashtags,
        contentMix: creatorData.contentMix
    };
}


// ==================== FULL APPLICATION FLOW ====================

async function submitApplication(campaignId, userId, accessToken, personalNote) {
    console.log(`\n[Marketplace] ========= Application Submission =========`);
    console.log(`[Marketplace] Campaign: ${campaignId} | Creator: ${userId}`);

    // Check for duplicate application
    const existing = await DealApplication.findOne({ campaignId, creatorId: userId });
    if (existing) {
        console.log('[Marketplace] Duplicate application detected');
        return { success: false, error: 'You have already applied to this campaign' };
    }

    // Get campaign
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) return { success: false, error: 'Campaign not found' };
    if (campaign.status !== 'open') return { success: false, error: 'Campaign is no longer accepting applications' };

    // Collect creator data from Instagram
    const creatorData = await collectCreatorData(userId, accessToken);

    // AI match score
    const matchResult = await calculateMatchScore(campaign, creatorData);

    // AI pitch
    const pitch = await generateApplicationPitch(campaign, creatorData);

    // Build media kit
    const mediaKit = buildMediaKit(creatorData);

    // Create application
    const application = await DealApplication.create({
        campaignId,
        creatorId: userId,
        matchScore: matchResult.score,
        matchReasons: matchResult.reasons,
        pitch: {
            subject: pitch.subject,
            body: pitch.body,
            generatedAt: new Date()
        },
        mediaKit,
        showcasePosts: creatorData.topPosts,
        personalNote: personalNote || '',
        applicationStatus: 'pending',
        appliedAt: new Date()
    });

    // Increment campaign application count
    await Campaign.findByIdAndUpdate(campaignId, { $inc: { applicationsCount: 1 } });

    console.log(`[Marketplace] Application submitted! Score: ${matchResult.score}%`);
    console.log(`[Marketplace] ========= Submission Complete =========\n`);

    return {
        success: true,
        application: {
            id: application._id,
            matchScore: matchResult.score,
            matchReasons: matchResult.reasons,
            pitchSubject: pitch.subject,
            status: 'pending'
        }
    };
}


module.exports = {
    collectCreatorData,
    calculateMatchScore,
    generateApplicationPitch,
    buildMediaKit,
    submitApplication
};
