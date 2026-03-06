const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const { WebhookEvent, Token } = require('../model/Instaautomation');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const aiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

const INSTAGRAM_CONFIG = {
    graphBaseUrl: `${process.env.INSTAGRAM_GRAPH_API_BASE_URL || 'https://graph.instagram.com'}/v${process.env.INSTAGRAM_GRAPH_API_VERSION || '24.0'}`
};

// In-memory memory of tagged media to prevent analyzing the same viral post 100 times a minute
const recentlyAnalyzedMedia = new Set();

/**
 * Analyze an @mention comment to see if it's a viral tagging campaign, and if so, schedule a reply.
 */
async function handleMention(userId, commentData) {
    const mediaId = commentData.mediaId;
    if (!mediaId) return;

    // Prevent hammering the API or repeating analysis for the same post repeatedly
    if (recentlyAnalyzedMedia.has(mediaId)) {
        console.log(`[ViralTag] Media ${mediaId} already analyzed recently, skipping...`);
        return;
    }

    // Mark as checked to debounce
    recentlyAnalyzedMedia.add(mediaId);
    setTimeout(() => recentlyAnalyzedMedia.delete(mediaId), 60 * 60 * 1000); // 1 hour debounce

    try {
        console.log(`[ViralTag] Mention detected on media ${mediaId}. Verifying viral status...`);
        const tokenData = await Token.findOne({ userId });
        if (!tokenData) {
            console.error('[ViralTag] No access token found for user');
            return;
        }

        // Fetch recent comments on that media
        const commentsResponse = await axios.get(
            `${INSTAGRAM_CONFIG.graphBaseUrl}/${mediaId}/comments`,
            {
                params: {
                    access_token: tokenData.accessToken,
                    limit: 15
                }
            }
        );

        const recentComments = commentsResponse.data.data || [];
        if (recentComments.length < 5) {
            console.log('[ViralTag] Not enough recent comments to be considered a viral campaign.');
            return;
        }

        // Extract text
        const commentTexts = recentComments.map(c => c.text);

        // Use Gemini to analyze the context
        const prompt = `
            You are analyzing comments on an Instagram video.
            The main creator was just tagged in one of these comments.
            I will provide the last ${commentTexts.length} comments on this video.
            
            Determine if this looks like a "mass tagging campaign" where people are asking the main creator to weigh in, or if it's just a random one-off tag.
            Usually, if many different users are tagging the exact same creator or saying things like "wait until [Creator] sees this", it's a viral tag campaign.
            
            Comments:
            ${JSON.stringify(commentTexts)}
            
            Reply entirely with a JSON object format exactly like this:
            {
                "isViralTagCampaign": boolean,
                "reason": "short explanation"
            }
        `;

        if (!process.env.GEMINI_API_KEY) return;

        const result = await aiModel.generateContent(prompt);
        let responseText = result.response.text().trim();

        // Find JSON block
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return;

        const analysis = JSON.parse(jsonMatch[0]);
        console.log(`[ViralTag] Analysis for ${mediaId}:`, analysis);

        if (analysis.isViralTagCampaign) {
            console.log(`[ViralTag] Confirmed viral tag campaign! Scheduling reply in 24 hours.`);

            // Generate a cool natural reply using AI
            const replyPrompt = `
                Generate a short, appreciative, and slightly funny generic comment (under 15 words) that a popular creator would leave on a viral video they were heavily tagged in by their fans. Do NOT include quotes, emojis are fine.
            `;
            const replyResult = await aiModel.generateContent(replyPrompt);
            const replyMessage = replyResult.response.text().trim().replace(/"/g, '');

            // Calculate 24 hours from now
            const scheduledTime = new Date(Date.now() + 24 * 60 * 60 * 1000);

            // Save to DB to be picked up by a cron job/interval later
            await WebhookEvent.create({
                userId,
                eventType: 'viral_tag_scheduled_reply',
                payload: {
                    mediaId,
                    message: replyMessage,
                },
                processed: false,
                scheduledAt: scheduledTime
            });
            console.log(`[ViralTag] Reply scheduled for ${scheduledTime.toISOString()}`);
        }

    } catch (error) {
        console.error('[ViralTag] Error handling mention:', error.message);
    }
}

module.exports = {
    handleMention
};
