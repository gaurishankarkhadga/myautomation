const CreatorPersona = require('../model/CreatorPersona');
const CreatorAsset = require('../model/CreatorAsset');
const axios = require('axios');
const { generateContentWithFallback } = require('./geminiClient');

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
        const result = await generateContentWithFallback(prompt);
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

            SAFETY — ABSOLUTE RULES (never break these):
            - If the comment is hateful, abusive, or contains slurs → reply with ONLY a single emoji like 😂 or ❤️ or just ignore. NEVER mirror their language.
            - NEVER swear, curse, or use offensive language in your reply — even if they do.
            - NEVER insult the commenter back.
            - Stay positive or neutral no matter what they say.

            Output ONLY your reply. No quotes, no labels, nothing else.
            `;

        } else {
            console.log(`[AI-Service] No persona found for ${userId}, using generic creator prompt`);

            prompt = `
            You're replying to a ${contextType === 'dm' ? 'DM' : 'comment'} on your Instagram post. You're a real creator, not an AI.

            @${senderName}: "${incomingText}"

            SAFETY — ABSOLUTE RULES (never break these):
            - If the comment is hateful, abusive, toxic, or contains slurs/swear words → reply with ONLY "❤️" or "😂". Do NOT engage, do NOT mirror their language.
            - NEVER swear, curse, or use offensive/vulgar language in your reply — even if they do.
            - NEVER insult or attack the commenter.
            - Stay positive, chill, or neutral no matter what.

            FOR NORMAL/POSITIVE COMMENTS — Match their energy:
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
            - "f*** you" → "❤️"
            - "you suck" → "😂"

            Output ONLY the reply. Nothing else.
            `;
        }

        // Call Gemini
        console.log('[AI-Service] Calling Gemini 2.5 Flash for reply generation...');
        const result = await generateContentWithFallback(prompt);
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

        const result = await generateContentWithFallback(prompt);
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


// ==================== ONLINE CREATOR RESEARCH ====================

/**
 * Researches a creator's public online presence using Gemini.
 * Builds deep understanding of their niche, brand, content themes, and audience.
 * Results are cached in CreatorPersona.onlineResearch.
 *
 * @param {string} userId - Instagram User ID
 * @param {string} username - Instagram username for research
 * @returns {Promise<{success: boolean, research?: object}>}
 */
async function researchCreatorOnline(userId, username) {
    try {
        // Check if we already have recent research (cache for 7 days)
        const persona = await CreatorPersona.findOne({ userId });
        if (persona?.onlineResearch?.researchedAt) {
            const daysSinceResearch = (Date.now() - new Date(persona.onlineResearch.researchedAt).getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceResearch < 7) {
                console.log(`[AI-Service] Using cached online research for @${username} (${Math.round(daysSinceResearch)}d old)`);
                return { success: true, research: persona.onlineResearch, cached: true };
            }
        }

        console.log(`[AI-Service] Researching @${username} online presence...`);

        const prompt = `
        You are a social media researcher. Research this Instagram creator: @${username}

        Based on what you know about this creator (from your training data), provide:
        1. Their primary NICHE (fitness, beauty, tech, comedy, education, lifestyle, etc.)
        2. Their BRAND VOICE — how do they talk? Formal? Slang-heavy? Gen-Z energy? Professional?
        3. What PLATFORMS are they on? (YouTube, TikTok, Twitter, blog, podcast, etc.)
        4. Their CONTENT THEMES — what topics do they mainly cover?
        5. Their AUDIENCE TYPE — who follows them? (teens, professionals, moms, gamers, etc.)
        6. How do they INTERACT with fans? (casual, warm, professional, funny, etc.)

        ${persona?.communicationStyle ? `For context, their Instagram communication style has been analyzed as: "${persona.communicationStyle}"` : ''}
        ${persona?.toneKeywords?.length ? `Their tone keywords: ${persona.toneKeywords.join(', ')}` : ''}

        Return ONLY a JSON object (no markdown, no extra text):
        {
            "niche": "primary niche",
            "brandVoice": "detailed description of how they communicate",
            "knownPlatforms": ["instagram", "youtube", ...],
            "contentThemes": ["theme1", "theme2", ...],
            "audienceType": "who their audience is",
            "interactionStyle": "how they talk to fans in DMs"
        }

        If you don't know much about this specific creator, make reasonable inferences based on:
        - Their username style
        - Their communication patterns (if provided)
        - Common patterns for creators with similar profiles
        Be honest but helpful. Never fabricate specific facts.
        `;

        const result = await generateContentWithFallback(prompt);
        const responseText = result.response.text();
        const cleaned = cleanJsonString(responseText);
        const research = JSON.parse(cleaned);

        // Save to CreatorPersona
        const onlineResearch = {
            niche: research.niche || '',
            brandVoice: research.brandVoice || '',
            publicLinks: [],
            knownPlatforms: research.knownPlatforms || [],
            contentThemes: research.contentThemes || [],
            audienceType: research.audienceType || '',
            rawResearch: JSON.stringify(research),
            researchedAt: new Date()
        };

        await CreatorPersona.findOneAndUpdate(
            { userId },
            { onlineResearch },
            { upsert: true }
        );

        console.log(`[AI-Service] Online research complete for @${username}: niche=${research.niche}`);
        return { success: true, research: onlineResearch, cached: false };

    } catch (error) {
        console.error('[AI-Service] Online research failed:', error.message);
        return { success: false, error: error.message };
    }
}


// ==================== INTENT-BASED ASSET MATCHING ====================

/**
 * Matches a user's DM message to the creator's assets using AI intent detection.
 * Returns assets sorted by relevance, or default assets for generic messages.
 *
 * @param {string} incomingText - The user's DM message
 * @param {Array} creatorAssets - Array of active CreatorAsset documents
 * @returns {Promise<{matchedAssets: Array, isGenericMessage: boolean}>}
 */
async function matchCreatorAssets(incomingText, creatorAssets) {
    try {
        if (!creatorAssets || creatorAssets.length === 0) {
            return { matchedAssets: [], isGenericMessage: true };
        }

        // Build asset catalog for AI
        const assetCatalog = creatorAssets.map((a, i) => ({
            index: i,
            id: a._id.toString(),
            type: a.type,
            title: a.title,
            description: a.description,
            tags: a.tags,
            price: a.price,
            isDefault: a.isDefault
        }));

        const prompt = `
        A fan sent this DM to a creator: "${incomingText}"

        The creator has these assets available to share:
        ${JSON.stringify(assetCatalog, null, 2)}

        Analyze the fan's message and determine:
        1. Is this a GENERIC message (hi, hello, hey, what's up, random chat) or does the fan have a SPECIFIC intent?
        2. If specific intent — which assets are most relevant? Match by meaning, not just keywords.

        Return ONLY this JSON (no markdown):
        {
            "isGenericMessage": true/false,
            "matchedAssetIds": ["id1", "id2"],
            "matchReason": "why these assets match"
        }

        Rules:
        - If generic → return empty matchedAssetIds (the system will use defaults)
        - If specific → return up to 3 most relevant asset IDs, sorted by relevance
        - Match by MEANING — "I want to get fit" should match fitness products even if the word "fitness" isn't in the message
        - Simple reactions ("wow", "nice", emoji-only) are GENERIC
        - Questions about pricing, courses, links, products = SPECIFIC
        `;

        const result = await generateContentWithFallback(prompt);
        const responseText = result.response.text();
        const cleaned = cleanJsonString(responseText);
        const analysis = JSON.parse(cleaned);

        let matchedAssets = [];

        if (analysis.isGenericMessage) {
            // Use default assets
            matchedAssets = creatorAssets.filter(a => a.isDefault).sort((a, b) => b.priority - a.priority);
            console.log(`[AI-Service] Generic DM detected. Using ${matchedAssets.length} default assets.`);
        } else {
            // Use AI-matched assets
            const matchedIds = analysis.matchedAssetIds || [];
            matchedAssets = matchedIds
                .map(id => creatorAssets.find(a => a._id.toString() === id))
                .filter(Boolean);
            console.log(`[AI-Service] Specific intent detected: "${analysis.matchReason}". Matched ${matchedAssets.length} assets.`);
        }

        return {
            matchedAssets,
            isGenericMessage: Boolean(analysis.isGenericMessage),
            matchReason: analysis.matchReason || ''
        };

    } catch (error) {
        console.error('[AI-Service] Asset matching failed:', error.message);
        // Fallback: return default assets
        const defaults = creatorAssets.filter(a => a.isDefault);
        return { matchedAssets: defaults, isGenericMessage: true, matchReason: 'fallback' };
    }
}


// ==================== SMART DM REPLY WITH ASSETS ====================

/**
 * Generates an AI-powered DM reply with product/link/course recommendations.
 * Combines creator persona + online research + asset context.
 *
 * @param {string} userId - Creator's Instagram ID
 * @param {string} incomingText - The user's DM message
 * @param {string} senderName - Username of the DM sender
 * @param {Array} matchedAssets - Assets matched by intent or defaults
 * @param {boolean} isGenericMessage - Whether the message is generic
 * @returns {Promise<{text: string, recommendedAssets: Array, replyType: string}>}
 */
async function generateSmartDMReply(userId, incomingText, senderName, matchedAssets, isGenericMessage) {
    try {
        const persona = await CreatorPersona.findOne({ userId });

        // Build asset context for the prompt
        let assetContext = '';
        if (matchedAssets && matchedAssets.length > 0) {
            assetContext = matchedAssets.map(a => {
                let info = `- ${a.type.toUpperCase()}: "${a.title}"`;
                if (a.description) info += ` — ${a.description}`;
                if (a.url) info += ` | Link: ${a.url}`;
                if (a.price) info += ` | Price: ${a.price}`;
                return info;
            }).join('\n');
        }

        // Build persona context
        let personaContext = '';
        if (persona) {
            personaContext = `
            === YOUR PERSONALITY ===
            - Style: ${persona.communicationStyle || 'casual and friendly'}
            - Tone: ${(persona.toneKeywords || []).join(', ') || 'friendly'}
            - Reply style: ${persona.replyStyle || 'casual'}
            - Emoji: ${persona.emojiUsage || 'moderate'}
            - ${persona.lowercasePreference ? 'You type in lowercase' : 'Normal capitalization'}
            - Average reply length: ~${persona.averageReplyLength || 40} chars
            `;

            if (persona.onlineResearch?.niche) {
                personaContext += `
                === YOUR BRAND ===
                - Niche: ${persona.onlineResearch.niche}
                - Brand voice: ${persona.onlineResearch.brandVoice || 'casual'}
                - Content themes: ${(persona.onlineResearch.contentThemes || []).join(', ')}
                - Audience: ${persona.onlineResearch.audienceType || 'general'}
                `;
            }
        }

        let prompt;

        if (matchedAssets.length > 0) {
            prompt = `
            You ARE this Instagram creator replying to a DM. Not an assistant. The actual human.

            ${personaContext}

            === YOUR PRODUCTS/LINKS TO SHARE ===
            ${assetContext}

            === THE DM ===
            @${senderName}: "${incomingText}"
            ${isGenericMessage ? '(This is a generic/casual message — naturally weave in your recommendations)' : '(The fan seems interested in something specific — share the relevant items)'}

            Write a DM reply that:
            1. Responds naturally to what they said (match your personality)
            2. ${isGenericMessage
                    ? 'Casually mentions your product/link/course — like a friend sharing something cool, NOT a salesperson'
                    : 'Directly shares the relevant product/link/course since they asked about it'}
            3. Include the actual URLs from the assets above
            4. Keep it conversational — no bullet points, no "Here are my products"
            5. Max 2-3 short sentences

            SAFETY RULES:
            - Never be pushy or salesy
            - If hateful/abusive DM → reply with just "❤️" and do NOT share any links
            - Stay authentic to your personality

            Output ONLY your reply text. Nothing else.
            `;
        } else {
            // No assets to share — just reply naturally
            prompt = `
            You ARE this Instagram creator replying to a DM. Not an assistant. The actual human.

            ${personaContext}

            @${senderName}: "${incomingText}"

            Reply naturally in your style. Max 1-2 sentences.
            SAFETY: If hateful → just "❤️". Never swear. Stay positive.

            Output ONLY your reply. Nothing else.
            `;
        }

        console.log('[AI-Service] Generating smart DM reply with asset context...');
        const result = await generateContentWithFallback(prompt);
        const reply = result.response.text().trim().replace(/^["']|["']$/g, '');

        if (!reply || reply.length === 0) {
            return { text: '🔥', recommendedAssets: [], replyType: 'text' };
        }

        // Determine reply type
        let replyType = 'text';
        const recommendedAssets = matchedAssets.map(a => ({
            assetId: a._id.toString(),
            assetTitle: a.title,
            assetType: a.type
        }));

        if (matchedAssets.length > 0) {
            const hasImage = matchedAssets.some(a => a.imageUrl);
            const hasUrl = matchedAssets.some(a => a.url);
            if (hasImage) replyType = 'image';
            else if (hasUrl) replyType = 'text_with_link';
            if (matchedAssets.some(a => a.type === 'product' || a.type === 'course')) {
                replyType = 'product_recommendation';
            }
        }

        console.log(`[AI-Service] Smart DM reply generated: type=${replyType}, assets=${recommendedAssets.length}`);
        return { text: reply, recommendedAssets, replyType };

    } catch (error) {
        console.error('[AI-Service] Smart DM reply generation failed:', error.message);
        return { text: '🔥', recommendedAssets: [], replyType: 'text' };
    }
}


module.exports = {
    analyzeProfile,
    generateSmartReply,
    analyzeComment,
    researchCreatorOnline,
    matchCreatorAssets,
    generateSmartDMReply
};
