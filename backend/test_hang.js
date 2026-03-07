require('dotenv').config();
const mongoose = require('mongoose');
const chatService = require('./service/chatService');

async function run() {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected.");

    console.log("Testing turn off dms...");
    await chatService.processMessage("testuser_verif1", "turn off dms", null);
    console.log("Done turn off dms");

    console.log("Testing learn my chat style...");
    await chatService.processMessage("testuser_verif1", "learn my chat style", null);
    console.log("Done learn my chat style");

    console.log("Finished all tests.");
    process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
