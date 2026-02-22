const { GoogleGenerativeAI } = require("@google/generative-ai");
const BrandDeal = require('../model/BrandDeal');
const axios = require('axios');

// Initialize Gemini with Google Search Grounding
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Model WITH Google Search Grounding enabled — this allows real-time web search
const searchModel = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    tools: [{ googleSearch: {} }]
});

// Standard model for non-search tasks (outreach templates etc.)
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

    // Step 1: Fetch profile info
    const profileRes = await axios.get(`${GRAPH_BASE}/${userId}`, {
        params: {
            fields: 'id,username,name,biography,followers_count,media_count,profile_picture_url',
            access_token: accessToken
        }
    });

    const profile = profileRes.data;
    console.log(`[BrandDeals] Profile: @${profile.username} | ${profile.followers_count} followers`);

    // Step 2: Fetch recent media with engagement metrics
    const mediaRes = await axios.get(`${GRAPH_BASE}/${userId}/media`, {
        params: {
            fields: 'id,caption,media_type,timestamp,like_count,comments_count,permalink',
            limit: 25,
            access_token: accessToken
        }
    });

    const posts = mediaRes.data.data || [];
    console.log(`[BrandDeals] Fetched ${posts.length} recent posts`);

    // Step 3: Calculate engagement metrics
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
        captions: allCaptions.slice(0, 15).join('\n---\n') // For niche analysis
    };

    console.log(`[BrandDeals] Engagement rate: ${engagementRate}% | Tier: ${creatorData.followerTier}`);
    console.log(`[BrandDeals] Top hashtags: ${topHashtags.slice(0, 5).join(', ')}`);

    return creatorData;
}


// ==================== AI BRAND DEAL ANALYSIS ====================

async function analyzeCreatorForBrands(userId, accessToken) {
    console.log(`\n[BrandDeals] ========== Starting Brand Deal Analysis ==========`);
    console.log(`[BrandDeals] User: ${userId}`);

    // Create initial record with 'analyzing' status
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
        // Step 1: Collect creator data from Instagram
        const creatorData = await collectCreatorData(userId, accessToken);

        // Step 2: Use Gemini to detect niche from captions
        console.log('[BrandDeals] Detecting niche via AI...');
        const nichePrompt = `
        Analyze these Instagram post captions and hashtags. Determine the creator's primary niche and sub-niches.

        CAPTIONS:
        ${creatorData.captions.substring(0, 3000)}

        TOP HASHTAGS:
        ${creatorData.topHashtags.join(', ')}

        BIO: ${creatorData.bio}

        Return ONLY a JSON object:
        {
            "primaryNiche": "the main niche (e.g., fitness, fashion, tech, food, beauty, travel, gaming, lifestyle, education, comedy)",
            "subNiches": ["sub-niche1", "sub-niche2"],
            "contentThemes": ["theme1", "theme2", "theme3"],
            "audienceType": "description of likely audience (e.g., 'Young women 18-25 interested in sustainable fashion')"
        }

        No markdown. Only raw JSON.
        `;

        const nicheResult = await standardModel.generateContent(nichePrompt);
        const nicheText = nicheResult.response.text();
        let nicheData;
        try {
            nicheData = JSON.parse(cleanJsonString(nicheText));
        } catch (e) {
            console.error('[BrandDeals] Niche parse error, using fallback');
            nicheData = {
                primaryNiche: 'lifestyle',
                subNiches: ['general'],
                contentThemes: ['content creation'],
                audienceType: 'general audience'
            };
        }

        console.log(`[BrandDeals] Niche detected: ${nicheData.primaryNiche} | Sub: ${nicheData.subNiches.join(', ')}`);

        // Step 3: Use Gemini with Google Search Grounding for REAL-TIME brand discovery
        console.log('[BrandDeals] Searching for real brand deals with Google Search Grounding...');

        const brandSearchPrompt = `
        I'm a ${nicheData.primaryNiche} content creator on Instagram with these stats:
        - Username: @${creatorData.username}
        - Followers: ${creatorData.followerCount.toLocaleString()} (${creatorData.followerTier} tier)
        - Engagement rate: ${creatorData.engagementRate}%
        - Average likes: ${creatorData.avgLikes} per post
        - Average comments: ${creatorData.avgComments} per post
        - Content focus: ${nicheData.subNiches.join(', ')}
        - Content themes: ${nicheData.contentThemes.join(', ')}
        - Audience type: ${nicheData.audienceType}
        - Bio: ${creatorData.bio}

        Search the internet and find me REAL, CURRENT brand collaboration and influencer partnership programs that I can apply to RIGHT NOW.

        I need you to find:
        1. Brands that have active influencer/creator programs in the ${nicheData.primaryNiche} space
        2. Affiliate programs I can join
        3. Brand ambassador programs currently accepting applications
        4. Creator marketplaces or platforms where brands are looking for ${nicheData.primaryNiche} creators
        5. Any brands specifically looking for ${creatorData.followerTier}-tier influencers

        For EACH brand deal found, provide:
        - Brand name
        - Program name (e.g., "Nike Creator Collective", "Sephora Squad")
        - Category (e.g., sportswear, beauty, tech)
        - Type of collaboration (sponsored post, affiliate, ambassador, product gifting, paid partnership)
        - Estimated budget/compensation range (if available)
        - Real URL to apply or learn more
        - Why this creator is a good match
        - Requirements to join (if known)
        - A brief description of the program

        Return the results as a JSON array with this EXACT format:
        [
            {
                "brandName": "Brand Name",
                "programName": "Program Name",
                "category": "category",
                "collaborationType": "type",
                "estimatedBudget": "$X - $Y per post or commission-based",
                "applyUrl": "https://real-url-to-apply.com",
                "description": "Brief description of the program",
                "whyItMatches": "Why this creator is a good fit",
                "requirements": "Minimum followers, engagement, etc.",
                "matchScore": 85
            }
        ]

        IMPORTANT RULES:
        - Find at least 8-12 brand deals
        - ALL URLs must be REAL, working URLs you found through search
        - matchScore should be 0-100 based on how well this creator fits (consider followers, niche, engagement)
        - Sort by matchScore descending (best matches first)
        - Include a mix of big brands AND smaller/niche brands
        - Include both paid programs AND affiliate/commission programs
        - Do NOT make up URLs — only include URLs you actually found
        - Return ONLY the JSON array, no markdown, no explanation
        `;

        const brandResult = await searchModel.generateContent(brandSearchPrompt);
        const brandText = brandResult.response.text();
        let brandDeals;

        try {
            brandDeals = JSON.parse(cleanJsonString(brandText));
        } catch (e) {
            console.error('[BrandDeals] Brand deals parse error:', e.message);
            console.error('[BrandDeals] Raw response (first 500):', brandText.substring(0, 500));

            // Try to extract JSON array from the response
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

        // Validate and clean the results
        brandDeals = (Array.isArray(brandDeals) ? brandDeals : []).map(deal => ({
            brandName: deal.brandName || 'Unknown Brand',
            programName: deal.programName || '',
            category: deal.category || nicheData.primaryNiche,
            collaborationType: deal.collaborationType || 'partnership',
            estimatedBudget: deal.estimatedBudget || 'Varies',
            applyUrl: deal.applyUrl || '',
            description: deal.description || '',
            whyItMatches: deal.whyItMatches || '',
            requirements: deal.requirements || 'Check program page',
            matchScore: Math.min(100, Math.max(0, parseInt(deal.matchScore) || 50))
        }));

        // Sort by match score
        brandDeals.sort((a, b) => b.matchScore - a.matchScore);

        console.log(`[BrandDeals] Found ${brandDeals.length} brand deals`);
        brandDeals.slice(0, 3).forEach(d => {
            console.log(`[BrandDeals]   - ${d.brandName} (${d.matchScore}% match) | ${d.collaborationType}`);
        });

        // Step 4: Save results to MongoDB
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
                error: null
            },
            { new: true }
        );

        console.log(`[BrandDeals] ========== Analysis Complete ==========\n`);

        return {
            success: true,
            dealsFound: brandDeals.length,
            niche: nicheData.primaryNiche,
            engagementRate: creatorData.engagementRate,
            followerTier: creatorData.followerTier
        };

    } catch (error) {
        console.error(`[BrandDeals] Analysis failed:`, error.message);
        if (error.response) {
            console.error('[BrandDeals] API error:', JSON.stringify(error.response.data));
        }

        await BrandDeal.findOneAndUpdate(
            { userId },
            { status: 'failed', error: error.message },
            { new: true }
        );

        return { success: false, error: error.message };
    }
}


// ==================== OUTREACH TEMPLATE GENERATION (Phase 2) ====================

async function generateOutreachTemplate(userId, brandName, brandCategory) {
    console.log(`[BrandDeals] Generating outreach template for ${brandName}`);

    try {
        const dealRecord = await BrandDeal.findOne({ userId, status: 'completed' })
            .sort({ analysisTimestamp: -1 });

        if (!dealRecord || !dealRecord.creatorProfile) {
            return { success: false, error: 'No brand deal analysis found. Run analysis first.' };
        }

        const profile = dealRecord.creatorProfile;
        const deal = dealRecord.brandDeals.find(d =>
            d.brandName.toLowerCase() === brandName.toLowerCase()
        );

        const prompt = `
        Write a professional but friendly outreach email for an Instagram creator pitching a collaboration.

        CREATOR:
        - Username: @${profile.username}
        - Niche: ${profile.niche}
        - Followers: ${profile.followerCount.toLocaleString()}
        - Engagement rate: ${profile.engagementRate}%
        - Average likes: ${profile.avgLikes} per post

        BRAND: ${brandName}
        BRAND CATEGORY: ${brandCategory || deal?.category || 'general'}
        ${deal ? `PROGRAM: ${deal.programName || 'General partnership'}` : ''}
        ${deal ? `WHY MATCH: ${deal.whyItMatches}` : ''}

        Write an email with:
        1. A catchy, short subject line
        2. A warm but professional intro (who you are, your niche)
        3. Why you love their brand (be specific, not generic)
        4. Your value proposition (stats, engagement, audience fit)
        5. A clear call-to-action
        6. Keep it under 200 words total

        Return ONLY a JSON object:
        {
            "subject": "Email subject line",
            "body": "Full email body text"
        }

        No markdown. Only raw JSON.
        `;

        const result = await standardModel.generateContent(prompt);
        const responseText = result.response.text();
        const templateData = JSON.parse(cleanJsonString(responseText));

        // Save to the record
        await BrandDeal.findOneAndUpdate(
            { userId },
            {
                $push: {
                    outreachTemplates: {
                        brandName,
                        subject: templateData.subject,
                        body: templateData.body,
                        generatedAt: new Date()
                    }
                }
            }
        );

        console.log(`[BrandDeals] Outreach template generated for ${brandName}`);

        return {
            success: true,
            template: {
                subject: templateData.subject,
                body: templateData.body
            }
        };

    } catch (error) {
        console.error('[BrandDeals] Outreach template generation failed:', error.message);
        return { success: false, error: error.message };
    }
}


module.exports = {
    analyzeCreatorForBrands,
    generateOutreachTemplate
};
