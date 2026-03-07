const { generateContentWithFallback } = require('./geminiClient');
const fs = require('fs');
const path = require('path');
const ChatHistory = require('../model/ChatHistory');

// ==================== HANDLER REGISTRY (Auto-Discovery) ====================
const handlerRegistry = new Map();  // intent -> handler
const handlers = [];                // all handler instances

function loadHandlers() {
    const handlersDir = path.join(__dirname, 'handlers');

    if (!fs.existsSync(handlersDir)) {
        console.error('[ChatService] Handlers directory not found:', handlersDir);
        return;
    }

    const files = fs.readdirSync(handlersDir).filter(f => f.endsWith('.handler.js'));

    for (const file of files) {
        try {
            const handler = require(path.join(handlersDir, file));
            handlers.push(handler);

            for (const intent of handler.intents) {
                handlerRegistry.set(intent, handler);
            }

            console.log(`[ChatService] Loaded handler: ${handler.name} (${handler.intents.join(', ')})`);
        } catch (err) {
            console.error(`[ChatService] Failed to load handler ${file}:`, err.message);
        }
    }

    console.log(`[ChatService] ${handlers.length} handlers loaded, ${handlerRegistry.size} intents registered.`);
}

// Load handlers on startup
loadHandlers();

// ==================== GET ALL REGISTERED INTENTS ====================
function getIntentList() {
    const intentDocs = [];

    for (const handler of handlers) {
        for (const intent of handler.intents) {
            intentDocs.push(`- ${intent} (handler: ${handler.name})`);
        }
    }

    return intentDocs.join('\n');
}

// ==================== GEMINI INTENT PARSER ====================
// The brain: understands vague/partial/multi-language input and extracts structured intents

async function parseIntents(message, context) {
    const intentList = getIntentList();

    const prompt = `You are the AI brain of CreatorHub — a social media management platform for creators.
Your job: understand ANYTHING the creator says (no matter how vague, messy, or creative) and convert it into structured action intents.

CRITICAL RULES:
1. Creators are NOT tech-savvy. They write casually: typos, slang, abbreviations, emojis, Hinglish (Hindi+English), mixed languages, or just vibes. ALWAYS figure out what they ACTUALLY mean.
2. If the message has MULTIPLE requests, split into SEPARATE intents and execute ALL of them.
3. Return a JSON array of intent objects: {"intent": "<name>", "params": {}, "confidence": 0.0-1.0}
4. If they're just chatting, greeting, or asking a question → use "general_chat".
5. When UNSURE, pick the MOST LIKELY intent with lower confidence (0.5-0.7). NEVER ignore a request.
6. INFER missing details smartly:
   - "turn on replies" → they mean AI smart mode (best default)
   - "recent video" / "latest reel" / "last post" → target: "recent"
   - "my first post" / "oldest video" → target: "first"
   - "previous one" / "second last" → target: "previous"
   - "for few hours" → default 6 hours
   - "some comments" / "not all" → default 50 comments
   - "sab kuch chalu kar" → enable_all_automation
   - "band karo" / "sab band" → disable_all_automation
7. If the creator mentions a NUMBER (like "100", "50", "24"), figure out if it's hours, comment count, or price from CONTEXT.
8. If the creator mentions a platform name ("youtube", "insta", "all"), map it to platform preferences.
9. Common abbreviations: "dm" = direct message, "yt" = youtube, "insta/ig" = instagram, "auto" = automation, "hrs" = hours

AVAILABLE INTENTS:
${intentList}
- general_chat (for general questions, greetings, help, feedback, or anything not matching above)

CONTEXT:
- Creator's userId: ${context.userId}
- Connected platforms: Instagram, YouTube (possibly)
- The creator manages their social media automation through this chat.

EXAMPLES (covering diverse real-world inputs):
User: "replies on" → [{"intent": "enable_comment_autoreply", "params": {"mode": "ai_smart"}, "confidence": 0.85}]
User: "stop dms" → [{"intent": "disable_dm_autoreply", "params": {}, "confidence": 0.9}]
User: "add course 29$ xyz.com" → [{"intent": "add_asset", "params": {"type": "course", "price": "29", "url": "xyz.com", "title": "Course"}, "confidence": 0.8}]
User: "what's happening" → [{"intent": "get_status", "params": {}, "confidence": 0.85}]
User: "turn on replies and find deals" → [{"intent": "enable_comment_autoreply", "params": {"mode": "ai_smart"}, "confidence": 0.9}, {"intent": "find_brand_deals", "params": {}, "confidence": 0.9}]
User: "deal milao" → [{"intent": "find_brand_deals", "params": {}, "confidence": 0.85}]
User: "hello" → [{"intent": "general_chat", "params": {}, "confidence": 1.0}]
User: "only automate my recent video" → [{"intent": "set_content_target", "params": {"target": "recent"}, "confidence": 0.9}]
User: "reply to top 100 comments only" → [{"intent": "set_comment_limit", "params": {"maxReplies": 100}, "confidence": 0.9}]
User: "automate all platforms" → [{"intent": "enable_all_automation", "params": {"mode": "ai_smart"}, "confidence": 0.9}]
User: "only automate first video and reply to 50 comments for 12 hours" → [{"intent": "set_content_target", "params": {"target": "first"}, "confidence": 0.9}, {"intent": "set_comment_limit", "params": {"maxReplies": 50}, "confidence": 0.9}, {"intent": "set_time_limit", "params": {"hours": 12}, "confidence": 0.9}]

ADVANCED EXAMPLES (messy, creative, real-world):
User: "bhai sab chalu kr de 2 ghante ke liye" → [{"intent": "enable_all_automation", "params": {"mode": "ai_smart"}, "confidence": 0.85}, {"intent": "set_time_limit", "params": {"hours": 2}, "confidence": 0.85}]
User: "meri latest reel pe comments ka reply kr" → [{"intent": "enable_comment_autoreply", "params": {"mode": "ai_smart"}, "confidence": 0.85}, {"intent": "set_content_target", "params": {"target": "recent"}, "confidence": 0.85}]
User: "just do 50 and stop" → [{"intent": "set_comment_limit", "params": {"maxReplies": 50}, "confidence": 0.8}]
User: "i want auto reply on my dm and comments both for 6 hrs" → [{"intent": "enable_comment_autoreply", "params": {"mode": "ai_smart"}, "confidence": 0.9}, {"intent": "enable_dm_autoreply", "params": {"mode": "ai_smart"}, "confidence": 0.9}, {"intent": "set_time_limit", "params": {"hours": 6}, "confidence": 0.9}]
User: "pause for now" → [{"intent": "disable_all_automation", "params": {}, "confidence": 0.8}]
User: "kl se band kr dena" → [{"intent": "set_time_limit", "params": {"hours": 24}, "confidence": 0.7}]
User: "only yt" → [{"intent": "set_platform_preference", "params": {"instagram": false, "youtube": true}, "confidence": 0.85}]
User: "mere recent wale pe 100 comments kr de" → [{"intent": "set_content_target", "params": {"target": "recent"}, "confidence": 0.85}, {"intent": "set_comment_limit", "params": {"maxReplies": 100}, "confidence": 0.85}]
User: "how many replies have u done?" → [{"intent": "get_status", "params": {}, "confidence": 0.85}]
User: "can you handle my youtube too?" → [{"intent": "set_platform_preference", "params": {"instagram": true, "youtube": true}, "confidence": 0.8}]
User: "add my course link mysite.com/course price 49 and turn on smart dm" → [{"intent": "add_asset", "params": {"type": "course", "url": "mysite.com/course", "price": "49", "title": "Course"}, "confidence": 0.9}, {"intent": "enable_dm_autoreply", "params": {"mode": "ai_with_assets"}, "confidence": 0.9}]
User: "setting dikha" → [{"intent": "get_preferences", "params": {}, "confidence": 0.85}]
User: "sab reset kr de" → [{"intent": "reset_preferences", "params": {}, "confidence": 0.9}]
User: "if dm fails send 'hey will reply soon'" → [{"intent": "set_dm_fallback", "params": {"message": "hey will reply soon"}, "confidence": 0.9}]
User: "run for 1 hour only on latest post, 30 comments max" → [{"intent": "set_content_target", "params": {"target": "recent"}, "confidence": 0.9}, {"intent": "set_time_limit", "params": {"hours": 1}, "confidence": 0.9}, {"intent": "set_comment_limit", "params": {"maxReplies": 30}, "confidence": 0.9}]

USER MESSAGE: "${message}"

Return ONLY a valid JSON array. No markdown, no explanation, no extra text. Just the JSON array.`;

    try {
        const result = await generateContentWithFallback(prompt, "gemini-2.5-flash");
        const responseText = result.response.text().trim();

        // Clean the response — remove markdown code fences if present
        let cleaned = responseText;
        if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
        }

        const intents = JSON.parse(cleaned);

        if (!Array.isArray(intents)) {
            console.error('[ChatService] Gemini returned non-array:', cleaned);
            return [{ intent: 'general_chat', params: {}, confidence: 0.5 }];
        }

        console.log(`[ChatService] Parsed ${intents.length} intent(s) from: "${message}"`);
        return intents;
    } catch (error) {
        console.error('[ChatService] Intent parsing failed:', error.message);
        return [{ intent: 'general_chat', params: { error: error.message }, confidence: 0.3 }];
    }
}

// ==================== EXECUTE INTENTS (Parallel) ====================
async function executeIntents(intents, context) {
    const results = [];

    // Separate general_chat from actionable intents
    const actionIntents = intents.filter(i => i.intent !== 'general_chat');
    const chatIntents = intents.filter(i => i.intent === 'general_chat');

    // Execute all actionable intents in parallel
    if (actionIntents.length > 0) {
        const promises = actionIntents.map(async (intentObj) => {
            const handler = handlerRegistry.get(intentObj.intent);

            if (!handler) {
                return {
                    intent: intentObj.intent,
                    success: false,
                    message: `I don't know how to handle "${intentObj.intent}" yet. This feature may be coming soon!`,
                    data: null
                };
            }

            try {
                const result = await handler.execute(intentObj.intent, intentObj.params || {}, context);
                return {
                    intent: intentObj.intent,
                    ...result
                };
            } catch (error) {
                console.error(`[ChatService] Handler error for ${intentObj.intent}:`, error.message);
                return {
                    intent: intentObj.intent,
                    success: false,
                    message: `Something went wrong with ${handler.name}: ${error.message}`,
                    data: null
                };
            }
        });

        const handlerResults = await Promise.all(promises);
        results.push(...handlerResults);
    }

    return { actionResults: results, hasChat: chatIntents.length > 0, chatIntents };
}

// ==================== FORMAT RESPONSE ====================
async function formatResponse(message, actionResults, hasChat, context) {
    const toasts = [];

    // Generate toasts from action results
    for (const result of actionResults) {
        toasts.push({
            type: result.success ? 'success' : 'error',
            title: formatIntentTitle(result.intent),
            message: result.message.substring(0, 100)
        });
    }

    // If we only had actions (no general chat), build response from results
    if (!hasChat && actionResults.length > 0) {
        if (actionResults.length === 1) {
            return {
                response: actionResults[0].message,
                toasts,
                actions: actionResults
            };
        }

        // Multiple actions — summarize
        const summary = actionResults.map((r, i) => {
            const icon = r.success ? '✅' : '❌';
            return `${icon} **${formatIntentTitle(r.intent)}**: ${r.message}`;
        }).join('\n\n');

        const successCount = actionResults.filter(r => r.success).length;
        const header = successCount === actionResults.length
            ? `Done! All ${actionResults.length} tasks completed:`
            : `Completed ${successCount}/${actionResults.length} tasks:`;

        return {
            response: `${header}\n\n${summary}`,
            toasts,
            actions: actionResults
        };
    }

    // General chat (with or without actions)
    let chatResponse = '';

    try {
        const contextInfo = actionResults.length > 0
            ? `\n\nI also just executed these actions for the creator:\n${actionResults.map(r => `- ${formatIntentTitle(r.intent)}: ${r.success ? 'Success' : 'Failed'} — ${r.message}`).join('\n')}`
            : '';

        const chatPrompt = `You are CreatorHub AI — a friendly, smart social media management assistant.
You're chatting with a creator who manages their Instagram/YouTube through you.
Be concise, helpful, and use emojis naturally. Keep responses under 3 sentences for simple questions.
If the creator asks about features, explain what you can do.
${contextInfo}

Your capabilities:
- Enable/disable comment auto-reply (modes: Reply Only, Smart Hide, AI Smart)
- Enable/disable DM auto-reply (modes: Static, AI Smart, AI + Assets)
- Manage creator assets (products, links, courses, ebooks, merch)
- Subscribe to Instagram webhooks
- Fetch Instagram profile
- Find and list brand deals
- Show automation status and logs
- Analyze creator persona for AI-powered replies
- Set content targeting (all, recent, first, previous, specific post)
- Set time limits (auto-stop after N hours)
- Set comment limits (reply to max N comments)
- Cross-platform automation (enable/disable all at once)
- Set fallback DM message (used when AI fails)
- Show and reset automation preferences

Creator's message: "${message}"

Respond naturally as their AI assistant.`;

        const result = await generateContentWithFallback(chatPrompt, "gemini-2.5-flash");
        chatResponse = result.response.text().trim();
    } catch (error) {
        console.error('[ChatService] Chat response generation failed:', error.message);
        chatResponse = "Hey! I had a small hiccup processing that. Could you try rephrasing? 😊";
    }

    // If there were also actions, prepend their results
    if (actionResults.length > 0) {
        const actionSummary = actionResults.map(r => {
            const icon = r.success ? '✅' : '❌';
            return `${icon} ${r.message}`;
        }).join('\n');

        chatResponse = `${actionSummary}\n\n${chatResponse}`;
    }

    return {
        response: chatResponse,
        toasts,
        actions: actionResults
    };
}

// ==================== INTENT TITLE FORMATTER ====================
function formatIntentTitle(intent) {
    const titles = {
        'enable_comment_autoreply': 'Comment Auto-Reply',
        'disable_comment_autoreply': 'Comment Auto-Reply',
        'configure_comment_autoreply': 'Comment Settings',
        'enable_dm_autoreply': 'DM Auto-Reply',
        'disable_dm_autoreply': 'DM Auto-Reply',
        'configure_dm_autoreply': 'DM Settings',
        'set_dm_fallback': 'DM Fallback',
        'add_asset': 'Asset Added',
        'list_assets': 'Your Assets',
        'delete_asset': 'Asset Deleted',
        'toggle_asset': 'Asset Toggle',
        'subscribe_webhooks': 'Webhooks',
        'get_profile': 'Profile',
        'analyze_persona': 'Persona Analysis',
        'find_brand_deals': 'Brand Deals',
        'list_brand_deals': 'Brand Deals',
        'get_status': 'Status',
        'get_comments_log': 'Comment Log',
        'get_dm_log': 'DM Log',
        'set_content_target': 'Content Target',
        'set_time_limit': 'Time Limit',
        'set_comment_limit': 'Comment Limit',
        'get_preferences': 'Preferences',
        'reset_preferences': 'Reset Preferences',
        'enable_all_automation': 'All Automation',
        'disable_all_automation': 'All Automation',
        'set_platform_preference': 'Platform Preference',
        'general_chat': 'Chat'
    };

    return titles[intent] || intent.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// ==================== MAIN PROCESS FUNCTION ====================
async function processMessage(userId, message, token) {
    const context = { userId, token };

    console.log(`\n[ChatService] ====== Processing: "${message}" (user: ${userId}) ======`);

    // Step 1: Parse intents from the message
    const intents = await parseIntents(message, context);
    console.log(`[ChatService] Intents:`, JSON.stringify(intents));

    // Step 2: Execute all intents
    const { actionResults, hasChat, chatIntents } = await executeIntents(intents, context);
    console.log(`[ChatService] Actions: ${actionResults.length}, HasChat: ${hasChat}`);

    // Step 3: Format the response
    const { response, toasts, actions } = await formatResponse(message, actionResults, hasChat, context);

    // Step 4: Save to chat history
    try {
        let chatHistory = await ChatHistory.findOne({ userId });

        if (!chatHistory) {
            chatHistory = new ChatHistory({ userId, messages: [] });
        }

        // Add user message
        chatHistory.messages.push({
            role: 'user',
            content: message,
            actions: [],
            toasts: [],
            timestamp: new Date()
        });

        // Add assistant response
        chatHistory.messages.push({
            role: 'assistant',
            content: response,
            actions: actions.map(a => ({
                intent: a.intent,
                success: a.success,
                message: a.message,
                data: a.data
            })),
            toasts,
            timestamp: new Date()
        });

        // Keep only last 100 messages to prevent bloat
        if (chatHistory.messages.length > 100) {
            chatHistory.messages = chatHistory.messages.slice(-100);
        }

        await chatHistory.save();
    } catch (err) {
        console.error('[ChatService] Failed to save chat history:', err.message);
    }

    console.log(`[ChatService] ====== Done ======\n`);

    return {
        success: true,
        response,
        actions,
        toasts
    };
}

// ==================== GET CHAT HISTORY ====================
async function getChatHistory(userId, limit = 50) {
    try {
        const chatHistory = await ChatHistory.findOne({ userId });

        if (!chatHistory) {
            return { success: true, messages: [] };
        }

        const messages = chatHistory.messages.slice(-limit);

        return { success: true, messages };
    } catch (error) {
        console.error('[ChatService] Failed to get history:', error.message);
        return { success: false, messages: [], error: error.message };
    }
}

module.exports = {
    processMessage,
    getChatHistory,
    loadHandlers  // Exposed for testing/reloading
};
