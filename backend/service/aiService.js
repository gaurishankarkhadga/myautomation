const { GoogleGenerativeAI } = require("@google/generative-ai");
const CreatorPersona = require('../model/CreatorPersona');
const axios = require('axios');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Helper to sanitize JSON from AI response
function cleanJsonString(input) {
    if (!input) return "{}";
    let cleaned = input.trim();
    // Remove markdown code blocks if present
    if (cleaned.startsWith("```json")) {
        cleaned = cleaned.replace(/^```json/, "").replace(/```$/, "");
    } else if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```/, "").replace(/```$/, "");
    }
    return cleaned.trim();
}

/**
 * Analyzes a creator's recent content to build a persona.
 * @param {string} userId - Instagram User ID
 * @param {string} accessToken - Valid Instagram Graph API token
 */
async function analyzeProfile(userId, accessToken) {
    console.log(`[AI-Service] Starting persona analysis for user: ${userId}`);

    try {
        // 1. Fetch recent media (captions)
        const mediaResponse = await axios.get(`https://graph.instagram.com/v23.0/${userId}/media`, {
            params: {
                fields: 'caption,media_type,timestamp',
                limit: 20,
                access_token: accessToken
            }
        });

        const captions = mediaResponse.data.data
            .filter(item => item.caption)
            .map(item => item.caption)
            .join("\n---\n");

        if (!captions) {
            console.log('[AI-Service] No captions found to analyze.');
            return;
        }

        // 2. Prepare Prompt for Analysis
        const prompt = `
        Analyze the following Instagram captions from a creator to understand their communication style.
        
        Captions:
        ${captions.substring(0, 5000)} // Truncate to avoid huge tokens just in case
        
        Return a JSON object with the following fields:
        {
            "communicationStyle": "Summary of their style (e.g., 'Energetic and emoji-heavy' or 'Professional and informative')",
            "toneKeywords": ["keyword1", "keyword2", "keyword3"],
            "commonPhrases": ["phrase 1", "phrase 2"],
            "emojiUsage": "Description of how they use emojis",
            "sentenceLength": "Description of their typical sentence length",
            "sampleReplies": [
                { "context": "Fan complimenting a post", "reply": "Draft a reply in their style" },
                { "context": "Question about a product", "reply": "Draft a reply in their style" }
            ]
        }
        Do not include markdown formatting, just the raw JSON.
        `;

        // 3. Call Gemini
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const cleanedJson = cleanJsonString(responseText);

        let analysisData;
        try {
            analysisData = JSON.parse(cleanedJson);
        } catch (e) {
            console.error('[AI-Service] Failed to parse AI response:', e);
            console.error('Response was:', responseText);
            return;
        }

        // 4. Save/Update Persona in DB
        await CreatorPersona.findOneAndUpdate(
            { userId },
            {
                userId,
                analysisTimestamp: new Date(),
                ...analysisData
            },
            { upsert: true, new: true }
        );

        console.log(`[AI-Service] Persona analysis completed for ${userId}`);

    } catch (error) {
        console.error('[AI-Service] Analysis failed:', error.message);
        if (error.response) {
            console.error('API Error:', error.response.data);
        }
    }
}

/**
 * Generates a smart reply based on the creator's persona.
 * @param {string} userId - The creator's Instagram ID
 * @param {string} incomingText - The specific comment or DM to reply to
 * @param {string} contextType - "comment" or "dm"
 * @param {string} senderName - Name of the person who sent the message
 * @returns {Promise<string>} - The generated reply text
 */
async function generateSmartReply(userId, incomingText, contextType, senderName) {
    try {
        // 1. Load Persona
        const persona = await CreatorPersona.findOne({ userId });

        if (!persona) {
            console.log(`[AI-Service] No persona found for ${userId}, using generic fallback.`);
            return "Thanks for reaching out! ❤️"; // Fallback
        }

        // 2. Prepare Prompt
        const prompt = `
        You are an AI assistant acting as the Instagram creator who has this persona:
        - Style: ${persona.communicationStyle}
        - Tone: ${persona.toneKeywords.join(', ')}
        - Common Phrases: ${persona.commonPhrases.join(', ')}
        - Emoji Usage: ${persona.emojiUsage}
        
        Task: Write a ${contextType === 'dm' ? 'Direct Message' : 'Comment'} reply to @${senderName}.
        
        Incoming Message: "${incomingText}"
        
        Guidelines:
        - Be natural and authentic to the persona.
        - Keep it concise (Instagram style).
        - Use appropriate emojis if the persona dictates.
        - Do not use hashtags unless typical for a reply.
        - STRICTLY output ONLY the reply text, no quotes or explanations.
        `;

        // 3. Call Gemini
        const result = await model.generateContent(prompt);
        const reply = result.response.text().trim();

        return reply;

    } catch (error) {
        console.error('[AI-Service] Reply generation failed:', error.message);
        return "Thanks! 🔥"; // Safe fallback
    }
}

module.exports = {
    analyzeProfile,
    generateSmartReply
};
