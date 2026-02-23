const axios = require('axios');
const Campaign = require('../model/Campaign');
const xml2js = require('xml2js');

// CJ Affiliate Advertiser Lookup API
const CJ_API_BASE = 'https://advertiser-lookup.api.cj.com/v2/advertiser-lookup';
const CJ_API_TOKEN = process.env.CJ_API_TOKEN;
const CJ_PUBLISHER_CID = process.env.CJ_PUBLISHER_CID;

// CJ Category → Niche mapping
const CJ_NICHE_MAP = {
    'accessories': 'fashion',
    'art': 'art',
    'automotive': 'automotive',
    'beauty': 'beauty',
    'books/media': 'education',
    'business': 'business',
    'careers': 'career',
    'clothing': 'fashion',
    'clothing/apparel': 'fashion',
    'computer & electronics': 'tech',
    'computers/electronics': 'tech',
    'department stores/malls': 'lifestyle',
    'education': 'education',
    'entertainment': 'entertainment',
    'family': 'family',
    'financial services': 'finance',
    'food & drink': 'food',
    'food & drinks': 'food',
    'games & toys': 'gaming',
    'gifts & flowers': 'lifestyle',
    'health & beauty': 'beauty',
    'health & wellness': 'fitness',
    'health/beauty': 'beauty',
    'home & garden': 'home',
    'home/garden': 'home',
    'insurance': 'finance',
    'jewelry': 'fashion',
    'music': 'music',
    'non-profit': 'social-impact',
    'online services': 'tech',
    'pet care': 'pets',
    'shoes': 'fashion',
    'sports & fitness': 'fitness',
    'sports/fitness': 'fitness',
    'telecom': 'tech',
    'travel': 'travel',
    'web services': 'tech'
};

function mapCJCategory(cjCategory) {
    if (!cjCategory) return 'lifestyle';
    const lower = cjCategory.toLowerCase().trim();
    return CJ_NICHE_MAP[lower] || lower.split('/')[0].trim();
}


// ==================== FETCH FROM CJ API ====================

async function fetchCJAdvertisers(options = {}) {
    if (!CJ_API_TOKEN || !CJ_PUBLISHER_CID) {
        console.log('[CJ API] Missing CJ_API_TOKEN or CJ_PUBLISHER_CID — skipping');
        return [];
    }

    console.log('[CJ API] Fetching advertisers from CJ Affiliate...');

    const params = {
        'requestor-cid': CJ_PUBLISHER_CID,
        'records-per-page': options.limit || 100,
        'page-number': options.page || 1,
    };

    // Filter by specific category keyword
    if (options.keywords) {
        params['keywords'] = options.keywords;
    }

    // Fetch all advertisers (joined + not-joined)
    if (options.joinedOnly) {
        params['advertiser-ids'] = 'joined';
    }

    // Filter by category
    if (options.category) {
        params['category'] = options.category;
    }

    try {
        const response = await axios.get(CJ_API_BASE, {
            headers: {
                'Authorization': `Bearer ${CJ_API_TOKEN}`,
                'Accept': 'application/xml'
            },
            params
        });

        // Parse XML response
        const parsed = await xml2js.parseStringPromise(response.data, {
            explicitArray: false,
            ignoreAttrs: false
        });

        const root = parsed?.['cj-api']?.advertisers;
        if (!root) {
            console.log('[CJ API] No advertisers in response');
            return [];
        }

        let advertisers = root.advertiser;
        if (!advertisers) return [];
        if (!Array.isArray(advertisers)) advertisers = [advertisers];

        console.log(`[CJ API] Got ${advertisers.length} advertisers`);

        return advertisers.map(adv => ({
            externalId: adv['advertiser-id'] || '',
            brandName: adv['advertiser-name'] || 'Unknown Brand',
            category: adv['primary-category']?.parent || adv['primary-category'] || '',
            programUrl: adv['program-url'] || '',
            networkRank: adv['network-rank'] || '',
            sevenDayEpc: adv['seven-day-epc'] || '0',
            threeMonthEpc: adv['three-month-epc'] || '0',
            relationshipStatus: adv['relationship-status'] || 'not joined',
            mobileTrackingCertified: adv['mobile-tracking-certified'] === 'true',
            actions: adv.actions?.action || null
        }));

    } catch (error) {
        if (error.response) {
            console.error(`[CJ API] Error ${error.response.status}:`, error.response.data?.substring?.(0, 300) || error.response.data);
        } else {
            console.error('[CJ API] Request failed:', error.message);
        }
        return [];
    }
}


// ==================== SYNC CJ DEALS TO DATABASE ====================

async function syncCJDealsToDatabase(options = {}) {
    console.log('\n[CJ Sync] ========= Starting CJ Deal Sync =========');

    const cjAdvertisers = await fetchCJAdvertisers(options);

    if (cjAdvertisers.length === 0) {
        console.log('[CJ Sync] No advertisers fetched');
        return { synced: 0, skipped: 0, errors: 0 };
    }

    let synced = 0, skipped = 0, errors = 0;

    for (const adv of cjAdvertisers) {
        try {
            // Check if already exists
            const existing = await Campaign.findOne({
                source: 'cj',
                externalId: adv.externalId
            });

            if (existing) {
                // Update EPC and rank
                await Campaign.findByIdAndUpdate(existing._id, {
                    epc: adv.sevenDayEpc || adv.threeMonthEpc,
                    networkRank: adv.networkRank,
                    relationshipStatus: adv.relationshipStatus
                });
                skipped++;
                continue;
            }

            const niche = mapCJCategory(adv.category);
            const epc = parseFloat(adv.sevenDayEpc) || parseFloat(adv.threeMonthEpc) || 0;

            await Campaign.create({
                brandName: adv.brandName,
                brandWebsite: adv.programUrl,
                title: `${adv.brandName} Affiliate Program`,
                description: `Join the ${adv.brandName} affiliate program on CJ Affiliate. ${adv.category ? `Category: ${adv.category}.` : ''} ${adv.networkRank ? `Network Rank: #${adv.networkRank}.` : ''} Earn commissions by promoting their products to your audience.`,
                requirements: `Active social media presence in ${niche}. Content aligned with ${adv.brandName} brand values.`,
                deliverables: 'Promote products via posts, stories, or reels with your unique affiliate link',
                compensationType: 'affiliate',
                budgetMin: 0,
                budgetMax: 0,
                currency: 'USD',
                targetNiche: niche,
                targetSubNiches: [adv.category?.toLowerCase?.() || niche],
                minFollowers: 1000,
                maxFollowers: 1000000,
                category: niche,
                tags: [niche, 'affiliate', 'cj', adv.category?.toLowerCase?.() || ''].filter(Boolean),
                status: 'open',
                source: 'cj',
                externalId: adv.externalId,
                programUrl: adv.programUrl || `https://www.cj.com/advertiser/${adv.externalId}`,
                epc: `$${epc.toFixed(2)} per 100 clicks`,
                networkRank: adv.networkRank ? `#${adv.networkRank}` : '',
                relationshipStatus: adv.relationshipStatus,
                createdBy: 'cj-sync'
            });

            synced++;
        } catch (err) {
            console.error(`[CJ Sync] Error syncing ${adv.brandName}:`, err.message);
            errors++;
        }
    }

    console.log(`[CJ Sync] Done — Synced: ${synced} | Updated: ${skipped} | Errors: ${errors}`);
    console.log('[CJ Sync] ========= Sync Complete =========\n');

    return { synced, skipped, errors, total: cjAdvertisers.length };
}


// ==================== FETCH SPECIFIC CATEGORIES ====================

async function syncAllNiches() {
    const niches = ['beauty', 'fitness', 'fashion', 'travel', 'food', 'tech', 'entertainment', 'health'];
    let totalSynced = 0;

    for (const niche of niches) {
        console.log(`[CJ Sync] Syncing niche: ${niche}`);
        const result = await syncCJDealsToDatabase({ keywords: niche, limit: 25 });
        totalSynced += result.synced;
        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 500));
    }

    return { totalSynced, niches: niches.length };
}


module.exports = {
    fetchCJAdvertisers,
    syncCJDealsToDatabase,
    syncAllNiches
};
