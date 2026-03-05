const axios = require('axios');
const { Token } = require('../../model/Instaautomation');
const BrandDeal = require('../../model/BrandDeal');
const brandDealService = require('../brandDealService');

// ==================== BRAND DEALS HANDLER ====================
// Handles: find/list brand deals

const GRAPH_BASE = `${process.env.INSTAGRAM_GRAPH_API_BASE_URL || 'https://graph.instagram.com'}/v${process.env.INSTAGRAM_GRAPH_API_VERSION || '24.0'}`;

module.exports = {
    name: 'brandDeals',
    intents: ['find_brand_deals', 'list_brand_deals'],

    async execute(intent, params, context) {
        const { userId, token } = context;

        try {
            // ==================== FIND BRAND DEALS ====================
            if (intent === 'find_brand_deals') {
                const accessToken = token || (await Token.findOne({ userId }))?.accessToken;
                if (!accessToken) {
                    return { success: false, message: 'No access token found. Please reconnect your Instagram.' };
                }

                // Collect creator data and discover deals (this runs the full pipeline)
                const creatorData = await brandDealService.collectCreatorData(userId, accessToken);

                if (!creatorData || !creatorData.username) {
                    return { success: false, message: 'Couldn\'t fetch your profile data. Make sure Instagram is connected properly.' };
                }

                return {
                    success: true,
                    message: `I'm analyzing your profile (@${creatorData.username}) and discovering brand deals that match your niche. This takes about 30-60 seconds. I'll have results ready when you ask next!`,
                    data: { analyzing: true, username: creatorData.username }
                };
            }

            // ==================== LIST BRAND DEALS ====================
            if (intent === 'list_brand_deals') {
                const latestDeal = await BrandDeal.findOne({ userId })
                    .sort({ analysisTimestamp: -1 })
                    .lean();

                if (!latestDeal || !latestDeal.brandDeals || latestDeal.brandDeals.length === 0) {
                    return {
                        success: true,
                        message: 'No brand deals found yet. Say "find brand deals" and I\'ll discover opportunities that match your niche!',
                        data: { deals: [], count: 0 }
                    };
                }

                const dealList = latestDeal.brandDeals.slice(0, 5).map((d, i) => {
                    const score = d.matchScore ? ` (${d.matchScore}% match)` : '';
                    return `${i + 1}. **${d.brandName}**${score}\n   ${d.collaborationType || ''} · ${d.estimatedBudget || 'Budget TBD'}\n   ${d.description || ''}`;
                }).join('\n\n');

                return {
                    success: true,
                    message: `Found **${latestDeal.brandDeals.length}** brand deals for you:\n\n${dealList}\n\nUse the Advanced Settings page to manage pitches and track deal status.`,
                    data: { deals: latestDeal.brandDeals, count: latestDeal.brandDeals.length }
                };
            }

            return { success: false, message: 'Unknown brand deals action.' };
        } catch (error) {
            console.error('[Handler:brandDeals] Error:', error.message);
            return { success: false, message: `Brand deal operation failed: ${error.message}` };
        }
    }
};
