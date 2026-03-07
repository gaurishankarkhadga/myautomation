const { GoogleGenerativeAI } = require('@google/generative-ai');
const { incrementGeminiUsage } = require('./quotaService');

// Parse keys from both possible env vars
const keysString = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
const apiKeys = keysString.split(',').map(k => k.trim()).filter(k => k);

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
        // If it's a 429 Too Many Requests and we haven't tried all keys yet
        if (error.status === 429 && attempts < apiKeys.length - 1) {
            console.warn(`[GeminiClient] API Key hit rate limit (429). Automatically falling back to next available key... (Attempt ${attempts + 1}/${apiKeys.length - 1})`);
            return await generateContentWithFallback(prompt, modelName, attempts + 1);
        }
        
        // Either not a 429, or we've exhausted all keys
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
