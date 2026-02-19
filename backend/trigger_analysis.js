require('dotenv').config();
const mongoose = require('mongoose');
const aiService = require('./service/aiService');

const tokenSchema = new mongoose.Schema({ userId: String, accessToken: String });
const Token = mongoose.model('Token', tokenSchema);

async function trigger() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const userId = '26784030441232364';

        // Get the token
        const t = await Token.findOne({ userId });
        if (!t) {
            console.error('No token found');
            return;
        }

        console.log(`Found token for ${userId}, starting analysis...`);
        await aiService.analyzeProfile(userId, t.accessToken);

        console.log('Analysis function finished (check logs above for specific outcome)');

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

trigger();
