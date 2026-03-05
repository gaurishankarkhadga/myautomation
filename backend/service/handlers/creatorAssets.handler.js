const CreatorAsset = require('../../model/CreatorAsset');

// ==================== CREATOR ASSETS HANDLER ====================
// Handles: add/list/delete/toggle creator assets (products, links, courses, etc.)

module.exports = {
    name: 'creatorAssets',
    intents: ['add_asset', 'list_assets', 'delete_asset', 'toggle_asset'],

    async execute(intent, params, context) {
        const { userId } = context;

        try {
            // ==================== ADD ASSET ====================
            if (intent === 'add_asset') {
                const type = params.type || 'product';
                const title = params.title;

                if (!title) {
                    return { success: false, message: 'I need at least a title for the asset. What should I call it?' };
                }

                const asset = await CreatorAsset.create({
                    userId,
                    type,
                    title: title.trim(),
                    description: params.description || '',
                    url: params.url || '',
                    imageUrl: params.imageUrl || '',
                    price: params.price || '',
                    tags: params.tags || [],
                    isDefault: params.isDefault || false,
                    priority: params.priority || 0,
                    isActive: true
                });

                const typeIcons = { product: '📦', link: '🔗', course: '📚', image: '🖼️', service: '⚙️', ebook: '📖', merch: '👕' };
                const icon = typeIcons[type] || '📎';

                return {
                    success: true,
                    message: `${icon} Asset "${title}" added as ${type}${params.price ? ` ($${params.price})` : ''}${params.url ? ` — ${params.url}` : ''}`,
                    data: asset.toObject()
                };
            }

            // ==================== LIST ASSETS ====================
            if (intent === 'list_assets') {
                const filter = { userId };
                if (params.type) filter.type = params.type;
                if (params.activeOnly !== false) filter.isActive = true;

                const assets = await CreatorAsset.find(filter)
                    .sort({ priority: -1, createdAt: -1 })
                    .lean();

                if (assets.length === 0) {
                    return {
                        success: true,
                        message: 'You have no assets yet. Tell me to add products, links, or courses and I\'ll set them up!',
                        data: { assets: [], count: 0 }
                    };
                }

                const typeIcons = { product: '📦', link: '🔗', course: '📚', image: '🖼️', service: '⚙️', ebook: '📖', merch: '👕' };
                const assetList = assets.map((a, i) => {
                    const icon = typeIcons[a.type] || '📎';
                    const status = a.isActive ? '✅' : '❌';
                    return `${i + 1}. ${icon} **${a.title}** (${a.type}) ${status}${a.price ? ` — $${a.price}` : ''}${a.url ? ` — ${a.url}` : ''}`;
                }).join('\n');

                return {
                    success: true,
                    message: `You have **${assets.length}** assets:\n\n${assetList}`,
                    data: { assets, count: assets.length }
                };
            }

            // ==================== DELETE ASSET ====================
            if (intent === 'delete_asset') {
                const searchTitle = params.title || params.name;
                if (!searchTitle) {
                    return { success: false, message: 'Which asset should I delete? Give me the name.' };
                }

                // Fuzzy search by title (case-insensitive partial match)
                const asset = await CreatorAsset.findOne({
                    userId,
                    title: { $regex: searchTitle.trim(), $options: 'i' }
                });

                if (!asset) {
                    return { success: false, message: `Couldn't find an asset matching "${searchTitle}". Use "list assets" to see all your assets.` };
                }

                await CreatorAsset.findByIdAndDelete(asset._id);

                return {
                    success: true,
                    message: `Deleted asset "${asset.title}" (${asset.type}).`,
                    data: { deletedId: asset._id, title: asset.title }
                };
            }

            // ==================== TOGGLE ASSET ====================
            if (intent === 'toggle_asset') {
                const searchTitle = params.title || params.name;
                if (!searchTitle) {
                    return { success: false, message: 'Which asset should I toggle? Give me the name.' };
                }

                const asset = await CreatorAsset.findOne({
                    userId,
                    title: { $regex: searchTitle.trim(), $options: 'i' }
                });

                if (!asset) {
                    return { success: false, message: `Couldn't find an asset matching "${searchTitle}".` };
                }

                const newState = !asset.isActive;
                await CreatorAsset.findByIdAndUpdate(asset._id, { isActive: newState });

                return {
                    success: true,
                    message: `Asset "${asset.title}" is now ${newState ? 'active ✅' : 'inactive ❌'}.`,
                    data: { assetId: asset._id, title: asset.title, isActive: newState }
                };
            }

            return { success: false, message: 'Unknown asset action.' };
        } catch (error) {
            console.error('[Handler:creatorAssets] Error:', error.message);
            return { success: false, message: `Asset operation failed: ${error.message}` };
        }
    }
};
