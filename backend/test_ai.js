require('dotenv').config();
const aiService = require('./service/aiService');
const mongoose = require('mongoose');

async function testAI() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const testUserId = 'test_user_123';
        const testComment = 'Love this post! Great content as always.';

        // 1. Test Analysis (Mocking data since we can't fetch from IG without token)
        console.log('\n--- Testing Analysis (Mock) ---');
        // We can't easily test analyzeProfile without a real token/IG API access
        // But we can test generateSmartReply if we manually insert a persona.

        const CreatorPersona = require('./model/CreatorPersona');
        await CreatorPersona.findOneAndUpdate(
            { userId: testUserId },
            {
                communicationStyle: 'Excited and Emoji-loving',
                toneKeywords: ['happy', 'energetic', 'grateful'],
                commonPhrases: ['Thank you so much!', 'You rock!'],
                emojiUsage: 'Uses lots of 🔥 and ❤️',
                sampleReplies: []
            },
            { upsert: true }
        );
        console.log('Mock Persona inserted.');

        // 2. Test Smart Reply
        console.log('\n--- Testing Smart Reply ---');
        const reply = await aiService.generateSmartReply(testUserId, testComment, 'comment', 'fan_user');
        console.log('Generated Reply:', reply);

        if (reply && reply.length > 0) {
            console.log('✅ AI Service Working!');
        } else {
            console.error('❌ AI Service returned empty reply.');
        }

    } catch (error) {
        console.error('❌ Test Failed:', error);
    } finally {
        await mongoose.disconnect();
    }
}

testAI();
