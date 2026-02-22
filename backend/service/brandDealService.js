const { GoogleGenerativeAI } = require("@google/generative-ai");
const BrandDeal = require('../model/BrandDeal');
const axios = require('axios');

// Initialize Gemini with Google Search Grounding
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Model WITH Google Search Grounding — real-time web search
const searchModel = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    tools: [{ googleSearch: {} }]
});

// Standard model for non-search tasks
const standardModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Instagram Graph API base URL
const GRAPH_BASE = `${process.env.INSTAGRAM_GRAPH_API_BASE_URL || 'https://graph.instagram.com'}/v${process.env.INSTAGRAM_GRAPH_API_VERSION || '24.0'}`;


// ==================== HELPERS ====================

function cleanJsonString(input) {
    if (!input) return "{}";
    let cleaned = input.trim();
    if (cleaned.startsWith("```json")) {
        cleaned = cleaned.replace(/^```json/, "").replace(/```$/, "");
    } else if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```/, "").replace(/```$/, "");
    }
    return cleaned.trim();
}

function getFollowerTier(followers) {
    if (followers < 1000) return 'nano';
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


// ==================== CREATOR DATA COLLECTION ====================

async function collectCreatorData(userId, accessToken) {
    console.log(`[BrandDeals] Collecting creator data for user: ${userId}`);

    // Fetch profile info
    const profileRes = await axios.get(`${GRAPH_BASE}/${userId}`, {
        params: {
            fields: 'id,username,name,biography,followers_count,media_count,profile_picture_url',
            access_token: accessToken
        }
    });

    const profile = profileRes.data;
    console.log(`[BrandDeals] Profile: @${profile.username} | ${profile.followers_count} followers`);

    // Fetch recent media with engagement metrics
    const mediaRes = await axios.get(`${GRAPH_BASE}/${userId}/media`, {
        params: {
            fields: 'id,caption,media_type,timestamp,like_count,comments_count,permalink,media_url,thumbnail_url',
            limit: 25,
            access_token: accessToken
        }
    });

    const posts = mediaRes.data.data || [];
    console.log(`[BrandDeals] Fetched ${posts.length} recent posts`);

    // Calculate engagement metrics
    let totalLikes = 0;
    let totalComments = 0;
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

    // Count hashtag frequency
    const hashtagCount = {};
    allHashtags.forEach(h => { hashtagCount[h] = (hashtagCount[h] || 0) + 1; });
    const topHashtags = Object.entries(hashtagCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([tag]) => tag);

    // Get top performing posts (for showcase)
    const topPosts = [...posts]
        .sort((a, b) => ((b.like_count || 0) + (b.comments_count || 0)) - ((a.like_count || 0) + (a.comments_count || 0)))
        .slice(0, 6)
        .map(p => ({
            id: p.id,
            caption: (p.caption || '').substring(0, 100),
            likes: p.like_count || 0,
            comments: p.comments_count || 0,
            type: p.media_type,
            permalink: p.permalink
        }));

    const creatorData = {
        username: profile.username,
        name: profile.name,
        bio: profile.biography || '',
        followerCount: profile.followers_count,
        mediaCount: profile.media_count,
        avgLikes,
        avgComments,
        engagementRate,
        contentTypes: { images, videos, carousels, reels },
        topHashtags,
        followerTier: getFollowerTier(profile.followers_count),
        captions: allCaptions.slice(0, 15).join('\n---\n'),
        topPosts
    };

    console.log(`[BrandDeals] Engagement: ${engagementRate}% | Tier: ${creatorData.followerTier}`);
    return creatorData;
}


// ==================== AI BRAND DEAL ANALYSIS ====================

async function analyzeCreatorForBrands(userId, accessToken) {
    console.log(`\n[BrandDeals] ========== Starting Brand Deal Analysis ==========`);
    console.log(`[BrandDeals] User: ${userId}`);

    // Create initial record
    let brandDealRecord = await BrandDeal.findOneAndUpdate(
        { userId },
        {
            userId,
            analysisTimestamp: new Date(),
            status: 'analyzing',
            brandDeals: [],
            error: null
        },
        { upsert: true, new: true }
    );

    try {
        // Step 1: Collect creator data
        const creatorData = await collectCreatorData(userId, accessToken);

        // Step 2: Detect niche
        console.log('[BrandDeals] Detecting niche via AI...');
        const nichePrompt = `
        Analyze these Instagram post captions and hashtags. Determine the creator's primary niche and sub-niches.

        CAPTIONS:
        ${creatorData.captions.substring(0, 3000)}

        TOP HASHTAGS: ${creatorData.topHashtags.join(', ')}
        BIO: ${creatorData.bio}

        Return ONLY a JSON object:
        {
            "primaryNiche": "the main niche (e.g., fitness, fashion, tech, food, beauty, travel, gaming, lifestyle, education, comedy)",
            "subNiches": ["sub-niche1", "sub-niche2"],
            "contentThemes": ["theme1", "theme2", "theme3"],
            "audienceType": "description of likely audience"
        }
        No markdown. Only raw JSON.
        `;

        const nicheResult = await standardModel.generateContent(nichePrompt);
        let nicheData;
        try {
            nicheData = JSON.parse(cleanJsonString(nicheResult.response.text()));
        } catch (e) {
            console.error('[BrandDeals] Niche parse error, using fallback');
            nicheData = { primaryNiche: 'lifestyle', subNiches: ['general'], contentThemes: ['content creation'], audienceType: 'general audience' };
        }

        console.log(`[BrandDeals] Niche: ${nicheData.primaryNiche} | Sub: ${nicheData.subNiches.join(', ')}`);

        // Step 3: Search for real brand deals WITH contact info
        console.log('[BrandDeals] Searching for brand deals with Google Search Grounding...');

        const brandSearchPrompt = `
        I'm a ${nicheData.primaryNiche} content creator on Instagram:
        - Username: @${creatorData.username}
        - Followers: ${creatorData.followerCount.toLocaleString()} (${creatorData.followerTier} tier)
        - Engagement rate: ${creatorData.engagementRate}%
        - Average likes: ${creatorData.avgLikes} | Average comments: ${creatorData.avgComments}
        - Content focus: ${nicheData.subNiches.join(', ')}
        - Audience: ${nicheData.audienceType}
        - Bio: ${creatorData.bio}

        Search the internet and find me REAL, CURRENT brand collaboration and influencer partnership programs.

        Find:
        1. Brands with active influencer/creator programs in ${nicheData.primaryNiche}
        2. Affiliate programs I can join
        3. Brand ambassador programs accepting applications
        4. Creator marketplaces looking for ${nicheData.primaryNiche} creators
        5. Brands specifically looking for ${creatorData.followerTier}-tier influencers

        For EACH brand deal, provide:
        - Brand name
        - Program name
        - Category
        - Type of collaboration (sponsored post, affiliate, ambassador, product gifting, paid partnership)
        - Estimated budget/compensation range
        - Description of the program
        - Why this creator is a good match
        - Requirements to join
        - Contact email (search for their influencer/partnerships/marketing email if available)
        - Program URL (the brand's influencer program page)
        - Match score 0-100

        Return as a JSON array:
        [
            {
                "brandName": "Brand Name",
                "programName": "Program Name",
                "category": "category",
                "collaborationType": "type",
                "estimatedBudget": "$X - $Y per post",
                "description": "Brief description",
                "whyItMatches": "Why this creator fits",
                "requirements": "Requirements",
                "contactEmail": "partnerships@brand.com or empty string if not found",
                "programUrl": "https://brand.com/influencer-program",
                "matchScore": 85
            }
        ]

        RULES:
        - Find 8-12 brand deals
        - Include REAL contact emails when findable (influencer@, partnerships@, creators@, collab@)
        - programUrl should be the brand's own influencer/creator program page
        - Sort by matchScore descending
        - Mix of big brands AND niche brands
        - Mix of paid AND affiliate/commission programs
        - Return ONLY the JSON array, no markdown
        `;

        const brandResult = await searchModel.generateContent(brandSearchPrompt);
        const brandText = brandResult.response.text();
        let brandDeals;

        try {
            brandDeals = JSON.parse(cleanJsonString(brandText));
        } catch (e) {
            console.error('[BrandDeals] Parse error:', e.message);
            const jsonMatch = brandText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                try {
                    brandDeals = JSON.parse(jsonMatch[0]);
                } catch (e2) {
                    throw new Error('Failed to parse brand deal results from AI');
                }
            } else {
                throw new Error('AI did not return valid brand deal data');
            }
        }

        // Clean and format results — each deal starts as 'discovered'
        brandDeals = (Array.isArray(brandDeals) ? brandDeals : []).map(deal => ({
            brandName: deal.brandName || 'Unknown Brand',
            programName: deal.programName || '',
            category: deal.category || nicheData.primaryNiche,
            collaborationType: deal.collaborationType || 'partnership',
            estimatedBudget: deal.estimatedBudget || 'Varies',
            description: deal.description || '',
            whyItMatches: deal.whyItMatches || '',
            requirements: deal.requirements || 'Check program page',
            contactEmail: deal.contactEmail || '',
            programUrl: deal.programUrl || '',
            matchScore: Math.min(100, Math.max(0, parseInt(deal.matchScore) || 50)),
            dealStatus: 'discovered',
            pitch: { subject: '', body: '', generatedAt: null },
            notes: '',
            priority: ''
        }));

        brandDeals.sort((a, b) => b.matchScore - a.matchScore);

        console.log(`[BrandDeals] Found ${brandDeals.length} brand deals`);
        brandDeals.slice(0, 3).forEach(d => {
            console.log(`[BrandDeals]   - ${d.brandName} (${d.matchScore}%) | Contact: ${d.contactEmail || 'N/A'}`);
        });

        // Build auto media kit
        const mediaKit = {
            followers: creatorData.followerCount,
            engagementRate: creatorData.engagementRate,
            avgLikes: creatorData.avgLikes,
            avgComments: creatorData.avgComments,
            niche: nicheData.primaryNiche,
            followerTier: creatorData.followerTier,
            topHashtags: creatorData.topHashtags.slice(0, 8),
            bio: creatorData.bio,
            contentMix: creatorData.contentTypes,
            generatedAt: new Date()
        };

        // Save results
        brandDealRecord = await BrandDeal.findOneAndUpdate(
            { userId },
            {
                status: 'completed',
                analysisTimestamp: new Date(),
                creatorProfile: {
                    username: creatorData.username,
                    followerCount: creatorData.followerCount,
                    mediaCount: creatorData.mediaCount,
                    engagementRate: creatorData.engagementRate,
                    avgLikes: creatorData.avgLikes,
                    avgComments: creatorData.avgComments,
                    niche: nicheData.primaryNiche,
                    subNiches: nicheData.subNiches,
                    contentTypes: creatorData.contentTypes,
                    topHashtags: creatorData.topHashtags,
                    followerTier: creatorData.followerTier,
                    bio: creatorData.bio
                },
                brandDeals,
                mediaKit,
                error: null
            },
            { new: true }
        );

        console.log(`[BrandDeals] ========== Analysis Complete ==========\n`);
        return { success: true, dealsFound: brandDeals.length, niche: nicheData.primaryNiche };

    } catch (error) {
        console.error(`[BrandDeals] Analysis failed:`, error.message);
        await BrandDeal.findOneAndUpdate({ userId }, { status: 'failed', error: error.message });
        return { success: false, error: error.message };
    }
}


// ==================== PITCH GENERATION ====================

async function generatePitch(userId, brandName, brandCategory) {
    console.log(`[BrandDeals] Generating pitch for ${brandName}`);

    try {
        const dealRecord = await BrandDeal.findOne({ userId, status: 'completed' }).sort({ analysisTimestamp: -1 });

        if (!dealRecord || !dealRecord.creatorProfile) {
            return { success: false, error: 'No analysis found. Run analysis first.' };
        }

        const profile = dealRecord.creatorProfile;
        const deal = dealRecord.brandDeals.find(d => d.brandName.toLowerCase() === brandName.toLowerCase());
        const kit = dealRecord.mediaKit;

        const prompt = `
        Write a professional but warm outreach pitch for an Instagram creator.

        CREATOR:
        - @${profile.username} | ${profile.niche} creator
        - ${profile.followerCount.toLocaleString()} followers (${profile.followerTier} tier)
        - ${profile.engagementRate}% engagement rate | Avg ${profile.avgLikes} likes
        - Bio: ${profile.bio}

        BRAND: ${brandName}
        CATEGORY: ${brandCategory || deal?.category || 'general'}
        ${deal ? `PROGRAM: ${deal.programName || 'General partnership'}` : ''}
        ${deal ? `WHY MATCH: ${deal.whyItMatches}` : ''}

        Write an email pitch with:
        1. Catchy subject line
        2. Warm intro (who you are, your niche, why you love their brand)
        3. Value proposition (stats, engagement, audience fit)
        4. Specific collab idea (what kind of content you'd create)
        5. Clear call-to-action
        6. Keep it under 200 words

        Sound like a real human creator, not corporate. Be enthusiastic but professional.

        Return ONLY a JSON object:
        { "subject": "Subject line", "body": "Full email body" }
        No markdown. Only raw JSON.
        `;

        const result = await standardModel.generateContent(prompt);
        const templateData = JSON.parse(cleanJsonString(result.response.text()));

        // Store the pitch inline with the deal
        if (deal) {
            const dealIndex = dealRecord.brandDeals.findIndex(
                d => d.brandName.toLowerCase() === brandName.toLowerCase()
            );
            if (dealIndex !== -1) {
                await BrandDeal.findOneAndUpdate(
                    { userId, 'brandDeals.brandName': brandName },
                    {
                        $set: {
                            [`brandDeals.${dealIndex}.pitch`]: {
                                subject: templateData.subject,
                                body: templateData.body,
                                generatedAt: new Date()
                            }
                        }
                    }
                );
            }
        }

        console.log(`[BrandDeals] Pitch generated for ${brandName}`);
        return { success: true, pitch: { subject: templateData.subject, body: templateData.body } };

    } catch (error) {
        console.error('[BrandDeals] Pitch generation failed:', error.message);
        return { success: false, error: error.message };
    }
}


// ==================== DEAL STATUS MANAGEMENT ====================

async function updateDealStatus(userId, brandName, newStatus) {
    try {
        const dealRecord = await BrandDeal.findOne({ userId, status: 'completed' }).sort({ analysisTimestamp: -1 });
        if (!dealRecord) return { success: false, error: 'No deals found' };

        const dealIndex = dealRecord.brandDeals.findIndex(
            d => d.brandName.toLowerCase() === brandName.toLowerCase()
        );
        if (dealIndex === -1) return { success: false, error: 'Deal not found' };

        const updateFields = {
            [`brandDeals.${dealIndex}.dealStatus`]: newStatus,
            [`brandDeals.${dealIndex}.statusUpdatedAt`]: new Date()
        };

        if (newStatus === 'saved') updateFields[`brandDeals.${dealIndex}.savedAt`] = new Date();
        if (newStatus === 'pitched') updateFields[`brandDeals.${dealIndex}.pitchedAt`] = new Date();

        await BrandDeal.findOneAndUpdate({ userId }, { $set: updateFields });

        console.log(`[BrandDeals] Status updated: ${brandName} → ${newStatus}`);
        return { success: true, dealStatus: newStatus };

    } catch (error) {
        console.error('[BrandDeals] Status update failed:', error.message);
        return { success: false, error: error.message };
    }
}

async function saveDealNotes(userId, brandName, notes) {
    try {
        const dealRecord = await BrandDeal.findOne({ userId, status: 'completed' }).sort({ analysisTimestamp: -1 });
        if (!dealRecord) return { success: false, error: 'No deals found' };

        const dealIndex = dealRecord.brandDeals.findIndex(
            d => d.brandName.toLowerCase() === brandName.toLowerCase()
        );
        if (dealIndex === -1) return { success: false, error: 'Deal not found' };

        await BrandDeal.findOneAndUpdate(
            { userId },
            { $set: { [`brandDeals.${dealIndex}.notes`]: notes } }
        );

        return { success: true };

    } catch (error) {
        return { success: false, error: error.message };
    }
}


module.exports = {
    analyzeCreatorForBrands,
    generatePitch,
    updateDealStatus,
    saveDealNotes
};
