const { GoogleGenerativeAI } = require("@google/generative-ai");
const CreatorPersona = require('../model/CreatorPersona');
const axios = require('axios');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


// ==================== REPLY FETCHING ====================

/**
 * Fetches creator's actual comment-reply pairs from Instagram.
 * Goes through recent posts → comments → replies, and finds the creator's own replies.
 */
async function fetchCreatorReplies(userId, posts, accessToken) {
    const replyPairs = [];

    for (const post of posts) {
        try {
            // Fetch comments on this post
            const commentsRes = await axios.get(`${GRAPH_BASE}/${post.id}/comments`, {
                params: {
                    fields: 'id,text,from{id,username},timestamp',
                    limit: 25,
                    access_token: accessToken
                }
            });

            const comments = commentsRes.data.data || [];

            for (const comment of comments) {
                // Skip if no text or no from data
                if (!comment.text || !comment.from) continue;

                try {
                    // Fetch replies to this comment
                    const repliesRes = await axios.get(`${GRAPH_BASE}/${comment.id}/replies`, {
                        params: {
                            fields: 'id,text,from{id,username},timestamp',
                            access_token: accessToken
                        }
                    });

                    const replies = repliesRes.data.data || [];

                    // Find creator's own replies
                    for (const reply of replies) {
                        if (reply.from && String(reply.from.id) === String(userId) && reply.text) {
                            replyPairs.push({
                                commentText: comment.text,
                                commenterUsername: comment.from.username || 'unknown',
                                creatorReply: reply.text
                            });
                        }
                    }
                } catch (replyErr) {
                    // Some comments don't allow reply fetching — skip silently
                    continue;
                }
            }
        } catch (commentErr) {
            // Some posts don't allow comment fetching — skip silently
            continue;
        }

        // Rate limit protection — 200ms between posts
        await delay(200);
    }

    console.log(`[AI-Service] Collected ${replyPairs.length} creator reply pairs from ${posts.length} posts`);
    return replyPairs;
}


// ==================== PERSONA ANALYSIS ====================

/**
 * Analyzes a creator's profile by fetching their captions AND actual replies to fans.
 * Builds a comprehensive persona for AI-powered reply mimicry.
 *
 * @param {string} userId - Instagram User ID
 * @param {string} accessToken - Valid Instagram Graph API token
 * @returns {Promise<{success: boolean, dataSource?: string, replyPairsAnalyzed?: number, reason?: string}>}
 */
async function analyzeProfile(userId, accessToken) {
    console.log(`[AI-Service] Starting comprehensive persona analysis for user: ${userId}`);

    try {
        // Step 1: Fetch recent media (posts/reels)
        console.log('[AI-Service] Fetching recent media...');
        const mediaRes = await axios.get(`${GRAPH_BASE}/${userId}/media`, {
            params: {
                fields: 'id,caption,media_type,timestamp',
                limit: 15,
                access_token: accessToken
            }
        });

        const posts = mediaRes.data.data || [];
        console.log(`[AI-Service] Found ${posts.length} posts`);

        // Step 2: Extract captions
        const captions = posts
            .filter(item => item.caption)
            .map(item => item.caption)
            .join("\n---\n");

        // Step 3: Fetch creator's actual reply pairs
        console.log('[AI-Service] Fetching creator reply pairs from comments...');
        const replyPairs = await fetchCreatorReplies(userId, posts, accessToken);

        if (!captions && replyPairs.length === 0) {
            console.log('[AI-Service] No captions or replies found — cannot analyze.');
            return { success: false, reason: 'no_data' };
        }

        // Step 4: Build the analysis prompt
        let replyContext = '';
        if (replyPairs.length > 0) {
            replyContext = replyPairs
                .slice(0, 30) // Cap at 30 pairs to keep tokens reasonable
                .map(p => `Fan (@${p.commenterUsername}): "${p.commentText}" → Creator replied: "${p.creatorReply}"`)
                .join("\n");
        }

        const prompt = `
        Analyze this Instagram creator's communication style. I'm giving you TWO types of data:
        1. Their POST CAPTIONS (how they write publicly)
        2. Their ACTUAL REPLIES TO FANS (how they talk in conversation)

        The replies are MORE important — they show the creator's real voice, not their polished caption voice.

        ${captions ? `=== POST CAPTIONS ===\n${captions.substring(0, 3000)}` : '(No captions available)'}

        ${replyContext ? `\n=== ACTUAL REPLIES TO FANS (MOST IMPORTANT) ===\n${replyContext}` : '(No reply data available — base analysis on captions but assume replies are shorter and more casual)'}

        Create a detailed persona profile. Return a JSON object with these EXACT fields:
        {
            "communicationStyle": "Detailed description (e.g., 'Ultra casual, types mostly in lowercase, uses slang like fr and ngl, keeps replies under 5 words')",
            "toneKeywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
            "commonPhrases": ["exact phrases they repeat often", "another one", "etc"],
            "emojiUsage": "Specific description with actual emojis they use (e.g., 'Loves 🔥 and 😂, uses ❤️ for fan appreciation')",
            "emojiFrequency": "heavy OR moderate OR rare OR none",
            "sentenceLength": "Description (e.g., 'Ultra-short, 2-5 words per reply')",
            "replyStyle": "How they reply to fans specifically (e.g., 'Super short, mirrors fan energy, uses abbreviations, never formal')",
            "averageReplyLength": 25,
            "lowercasePreference": true,
            "slangPatterns": ["fr", "ngl", "lol", "haha", "tysm"],
            "sampleReplies": [
                { "context": "Fan reacts with wow/amazing", "reply": "Write a reply in their EXACT style" },
                { "context": "Fan asks how are you", "reply": "Write a reply in their EXACT style" },
                { "context": "Fan compliments their content", "reply": "Write a reply in their EXACT style" },
                { "context": "Fan asks a simple question", "reply": "Write a reply in their EXACT style" },
                { "context": "Fan sends a funny comment", "reply": "Write a reply in their EXACT style" },
                { "context": "Fan says they love the creator", "reply": "Write a reply in their EXACT style" }
            ]
        }

        CRITICAL RULES:
        - averageReplyLength should be the ACTUAL average character count from their real replies
        - lowercasePreference should be true if they mostly type in lowercase
        - slangPatterns should only include slang they ACTUALLY use, not made-up ones
        - sampleReplies must feel IDENTICAL to how this specific creator writes
        - If reply data is limited, extrapolate from caption tone but keep replies much shorter
        - Do NOT include markdown formatting. Return ONLY the raw JSON object.
        `;

        // Step 5: Call Gemini for analysis
        console.log('[AI-Service] Sending data to Gemini for persona analysis...');
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const cleanedJson = cleanJsonString(responseText);

        let analysisData;
        try {
            analysisData = JSON.parse(cleanedJson);
        } catch (parseErr) {
            console.error('[AI-Service] Failed to parse Gemini response:', parseErr.message);
            console.error('[AI-Service] Raw response (first 500 chars):', responseText.substring(0, 500));
            return { success: false, reason: 'parse_error' };
        }

        // Step 6: Save enriched persona to DB
        const dataSource = replyPairs.length > 0 ? 'captions_and_replies' : 'captions_only';

        const personaData = {
            userId,
            analysisTimestamp: new Date(),
            dataSource,
            replyPairsAnalyzed: replyPairs.length,
            replyExamples: replyPairs.slice(0, 20).map(p => ({
                commentText: p.commentText,
                creatorReply: p.creatorReply
            })),
            ...analysisData
        };

        await CreatorPersona.findOneAndUpdate(
            { userId },
            personaData,
            { upsert: true, new: true }
        );

        console.log(`[AI-Service] Persona analysis COMPLETE for ${userId}`);
        console.log(`[AI-Service] Source: ${dataSource} | Reply pairs: ${replyPairs.length} | Avg reply length: ${analysisData.averageReplyLength || 'N/A'}`);

        return { success: true, dataSource, replyPairsAnalyzed: replyPairs.length };

    } catch (error) {
        console.error('[AI-Service] Analysis failed:', error.message);
        if (error.response) {
            console.error('[AI-Service] API error details:', JSON.stringify(error.response.data));
        }
        return { success: false, reason: error.message };
    }
}


// ==================== SMART REPLY GENERATION ====================

/**
 * Generates a reply that mimics the creator's actual communication style.
 * Uses persona data (if available) to match their real reply patterns.
 *
 * @param {string} userId - The creator's Instagram ID
 * @param {string} incomingText - The comment or DM text to reply to
 * @param {string} contextType - "comment" or "dm"
 * @param {string} senderName - Username of the person who sent the message
 * @returns {Promise<string>} - The generated reply text
 */
async function generateSmartReply(userId, incomingText, contextType, senderName) {
    try {
        const persona = await CreatorPersona.findOne({ userId });

        let prompt;

        if (persona) {
            console.log(`[AI-Service] Persona found for ${userId} (source: ${persona.dataSource}, ${persona.replyPairsAnalyzed} reply pairs analyzed)`);

            // Build few-shot examples from ACTUAL creator replies
            let realExamples = '';
            if (persona.replyExamples && persona.replyExamples.length > 0) {
                realExamples = persona.replyExamples
                    .slice(0, 10)
                    .map(ex => `Fan: "${ex.commentText}" → You replied: "${ex.creatorReply}"`)
                    .join("\n");
            }

            // Build AI-generated style examples
            let styleExamples = '';
            if (persona.sampleReplies && persona.sampleReplies.length > 0) {
                styleExamples = persona.sampleReplies
                    .map(s => `- "${s.context}" → "${s.reply}"`)
                    .join("\n");
            }

            prompt = `
            You ARE this Instagram creator. Not an assistant. Not an AI. The actual human behind this account.

            === YOUR PERSONALITY (from analyzing your real Instagram activity) ===
            - Communication style: ${persona.communicationStyle || 'casual'}
            - Tone: ${(persona.toneKeywords || []).join(', ') || 'friendly'}
            - Reply style: ${persona.replyStyle || 'casual and short'}
            - Phrases you actually use: ${(persona.commonPhrases || []).join(', ') || 'none identified'}
            - Emoji usage: ${persona.emojiUsage || 'moderate'}
            - Emoji frequency: ${persona.emojiFrequency || 'moderate'}
            - Slang/abbreviations you use: ${(persona.slangPatterns || []).join(', ') || 'none'}
            - Your typical reply length: ~${persona.averageReplyLength || 30} characters
            - ${persona.lowercasePreference ? 'You type in lowercase' : 'You use normal capitalization'}

            ${realExamples ? `=== YOUR ACTUAL PAST REPLIES (match this EXACT energy) ===\n${realExamples}` : ''}

            ${styleExamples ? `=== YOUR REPLY PATTERNS ===\n${styleExamples}` : ''}

            === NOW REPLY ===
            Someone ${contextType === 'dm' ? "DM'd you" : 'commented on your post'}:
            @${senderName}: "${incomingText}"

            Write your reply. Match your patterns exactly:
            - Same length (~${persona.averageReplyLength || 30} chars)
            - Same emoji frequency (${persona.emojiFrequency || 'moderate'})
            - Same slang/abbreviations
            - ${persona.lowercasePreference ? 'lowercase like you always type' : 'your normal capitalization'}
            - React to what they ACTUALLY said — don't be generic

            Output ONLY your reply. No quotes, no labels, nothing else.
            `;

        } else {
            console.log(`[AI-Service] No persona found for ${userId}, using generic creator prompt`);

            prompt = `
            You're replying to a ${contextType === 'dm' ? 'DM' : 'comment'} on your Instagram post. You're a real creator, not an AI.

            @${senderName}: "${incomingText}"

            IMPORTANT — Mirror their energy:
            - If they're hyped/excited → match that energy, be hyped back
            - If they're asking a question → actually answer it naturally
            - If they're being funny → be funny back or react to the humor
            - If they're showing love → show love back genuinely
            - If it's a simple reaction (like "wow" or "nice") → keep your reply equally short

            NEVER say these (they sound like a bot):
            - "glad you liked it" / "glad you enjoyed it"
            - "thanks for reaching out" / "thanks for the love"
            - "I appreciate your support" / "means a lot"
            - "stay tuned" / "keep watching"
            - Any generic filler that could apply to ANY comment

            Your reply MUST feel specific to what @${senderName} actually said.

            Style:
            - Max 1 sentence, under 50 characters if possible
            - Type like you're texting — lowercase ok, abbreviations ok (haha, ikr, lol, tysm, fr, ngl)
            - 1 emoji max, only if natural
            - No hashtags, no exclamation spam

            Examples:
            - "wow" → "ikr 😂"
            - "this is fire" → "ayyy thank youu 🔥"
            - "how are you" → "doing good! hbu?"
            - "love this" → "you're the best fr"
            - "haha nice" → "hahaa 😆"

            Output ONLY the reply. Nothing else.
            `;
        }

        // Call Gemini
        console.log('[AI-Service] Calling Gemini 2.5 Flash for reply generation...');
        const result = await model.generateContent(prompt);
        const reply = result.response.text().trim();

        // Strip surrounding quotes if Gemini wraps the reply
        const cleanReply = reply.replace(/^["']|["']$/g, '');

        if (!cleanReply || cleanReply.length === 0) {
            console.warn('[AI-Service] Gemini returned empty reply, using emoji fallback');
            return "🔥";
        }

        console.log(`[AI-Service] Reply generated: "${cleanReply}"`);
        return cleanReply;

    } catch (error) {
        console.error('[AI-Service] Reply generation failed:', error.message);
        return "🔥"; // Minimal fallback — only on actual errors
    }
}


// ==================== COMMENT ANALYSIS (Spam/Toxic Detection) ====================

/**
 * Analyzes a comment to determine if it's spam, toxic, or genuine.
 * Uses Gemini for fast classification — no manual keywords needed.
 *
 * @param {string} commentText - The comment text to analyze
 * @param {string} senderName - Username of the commenter
 * @returns {Promise<{shouldHide: boolean, reason: string, category: string}>}
 */
async function analyzeComment(commentText, senderName) {
    try {
        const prompt = `Classify this Instagram comment. Return ONLY a JSON object.

Comment by @${senderName}: "${commentText}"

Categories:
- "genuine" = real fan interaction, compliment, question, reaction
- "spam" = promotion, links, "follow me", fake giveaway, bot-like repetition
- "toxic" = hate speech, bullying, slurs, harassment, threats, extremely negative

Return ONLY this JSON (no markdown, no extra text):
{"category": "genuine", "shouldHide": false, "reason": "short reason"}

Rules:
- Default to "genuine" if unsure
- Only mark shouldHide=true for clear spam or toxic content
- Casual slang, abbreviations, or emoji-only comments are GENUINE
- Simple reactions like "nice", "wow", "🔥" are GENUINE`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim();
        const cleaned = cleanJsonString(responseText);
        const parsed = JSON.parse(cleaned);

        console.log(`[AI-Service] Comment analysis for @${senderName}: category=${parsed.category}, shouldHide=${parsed.shouldHide}`);

        return {
            shouldHide: Boolean(parsed.shouldHide),
            reason: parsed.reason || '',
            category: parsed.category || 'genuine'
        };
    } catch (error) {
        console.error('[AI-Service] Comment analysis failed:', error.message);
        // Default to NOT hiding on error — safe fallback
        return { shouldHide: false, reason: 'analysis_failed', category: 'genuine' };
    }
}


module.exports = {
    analyzeProfile,
    generateSmartReply,
    analyzeComment
};
