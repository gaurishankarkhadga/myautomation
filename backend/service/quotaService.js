const { ApiUsage } = require('../model/Instaautomation');

async function incrementGeminiUsage() {
    try {
        const today = new Date().toISOString().split('T')[0];
        await ApiUsage.findOneAndUpdate(
            { dateString: today },
            { $inc: { geminiCalls: 1 }, lastUpdated: new Date() },
            { upsert: true }
        );
    } catch (err) {
        console.error('[QuotaService] Failed to track Gemini usage:', err.message);
    }
}

async function getGeminiUsage() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const usage = await ApiUsage.findOne({ dateString: today });
        return (usage ? usage.geminiCalls : 0);
    } catch (err) {
        return 0;
    }
}

module.exports = {
    incrementGeminiUsage,
    getGeminiUsage
};
