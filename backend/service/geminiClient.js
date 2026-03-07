const { GoogleGenerativeAI } = require('@google/generative-ai');
const { incrementGeminiUsage } = require('./quotaService');

// Parse keys from both possible env vars
const keysString = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
const apiKeys = keysString
    .split(',')
    .map(k => k.trim().replace(/^["']|["']$/g, '')) // Strip whitespace and any surrounding quotes
    .filter(k => k);

if (apiKeys.length === 0) {
    console.warn('[GeminiClient] WARNING: No Gemini API keys found in environment variables.');
} else {
    console.log(`[GeminiClient] Initialized with ${apiKeys.length} API key(s) for automatic failover.`);
}

let currentKeyIndex = 0;

function getNextModel(modelName) {
    if (apiKeys.length === 0) throw new Error('No Gemini API keys configured.');

    // Round-robin selection
    const key = apiKeys[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;

    const genAI = new GoogleGenerativeAI(key);
    return genAI.getGenerativeModel({ model: modelName });
}

async function generateContentWithFallback(prompt, modelName = 'gemini-2.5-flash', attempts = 0) {
    const model = getNextModel(modelName);

    try {
        const result = await model.generateContent(prompt);
        await incrementGeminiUsage(); // Track the successful usage
        return result;
    } catch (error) {
        const isRateLimit = error.status === 429;
        const isInvalidKey = error.status === 400 && error.message.includes('API key not valid');

        // If it's a 429 Too Many Requests or 400 Invalid Key and we haven't tried all keys yet
        if ((isRateLimit || isInvalidKey) && attempts < apiKeys.length - 1) {
            console.warn(`[GeminiClient] API Key failed (${error.status}). Falling back to next available key... (Attempt ${attempts + 1}/${apiKeys.length - 1})`);
            return await generateContentWithFallback(prompt, modelName, attempts + 1);
        }

        // Exhausted all keys or different error
        throw error;
    }
}

function getAvailableKeysCount() {
    return apiKeys.length || 1;
}

module.exports = {
    generateContentWithFallback,
    getAvailableKeysCount
};
