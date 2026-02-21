const { GoogleGenerativeAI } = require("@google/generative-ai");
const CreatorPersona = require('../model/CreatorPersona');
const axios = require('axios');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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
        // 1. Load Persona (optional - enhances replies but not required)
        const persona = await CreatorPersona.findOne({ userId });

        let prompt;

        if (persona) {
            console.log(`[AI-Service] Persona found for ${userId}, generating personalized reply.`);
            // Persona-based prompt for personalized replies
            prompt = `
            You ARE this Instagram creator. You're not an AI — you're the actual person behind this account.
            
            Your vibe:
            - Style: ${persona.communicationStyle}
            - Tone: ${persona.toneKeywords.join(', ')}
            - Phrases you actually use: ${persona.commonPhrases.join(', ')}
            - Emoji habit: ${persona.emojiUsage}
            
            Someone ${contextType === 'dm' ? 'DM\'d' : 'commented on your post'}:
            @${senderName}: "${incomingText}"
            
            Reply like YOU would — not like a bot or customer service rep. Rules:
            - Sound human. Use casual language, slang, abbreviations if that's your style.
            - Keep it short (1-2 sentences max, this is Instagram not an email).
            - React naturally to what they said — if it's funny, laugh. If it's love, show love back.
            - Don't be generic. Make it feel like a real person replied.
            - No hashtags in replies.
            - Output ONLY the reply text. No quotes, no labels, nothing else.
            `;
        } else {
            console.log(`[AI-Service] No persona found for ${userId}, generating generic AI reply via Gemini.`);
            // Generic prompt - humanized creator style
            prompt = `
            You're an Instagram creator replying to a ${contextType === 'dm' ? 'DM' : 'comment'} on your post. You're a real person, not a bot.
            
            @${senderName} said: "${incomingText}"
            
            Reply like a real creator would. Rules:
            - Sound HUMAN. Type like you're texting a friend or fan — casual, warm, real.
            - Keep it short (1-2 sentences, under 80 characters ideally).
            - Actually respond to what they said. If they ask "how are you" — answer it. If they compliment you — thank them genuinely.
            - Use 1-2 emojis naturally (not forced).
            - DON'T sound like a corporate account or customer support.
            - DON'T use phrases like "Thanks for reaching out" or "I appreciate your support" — those sound robotic.
            - DO use casual language, abbreviations (haha, lol, tysm, omg, etc.) if it fits.
            - No hashtags.
            - Output ONLY the reply text. No quotes, no explanations, nothing else.
            
            Examples of good creator replies:
            - "haha doing great!! wbu? 😄"
            - "tysm that means a lot 🥹❤️"
            - "yoo glad you liked it! 🔥"
            - "omg thank youuu 🙏"
            `;
        }

        // 2. Call Gemini
        console.log(`[AI-Service] Calling Gemini 2.5 Flash for reply generation...`);
        const result = await model.generateContent(prompt);
        const reply = result.response.text().trim();

        // Remove surrounding quotes if Gemini wraps the reply
        const cleanReply = reply.replace(/^["']|["']$/g, '');

        if (!cleanReply || cleanReply.length === 0) {
            console.warn('[AI-Service] Gemini returned empty reply, using safe fallback.');
            return "Thanks for your comment! 🙌";
        }

        console.log(`[AI-Service] Gemini reply generated successfully: "${cleanReply}"`);
        return cleanReply;

    } catch (error) {
        console.error('[AI-Service] Reply generation failed:', error.message);
        return "Thanks! 🔥"; // Safe fallback only on actual errors
    }
}

module.exports = {
    analyzeProfile,
    generateSmartReply
};
