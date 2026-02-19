require('dotenv').config();
const mongoose = require('mongoose');

const personaSchema = new mongoose.Schema({ userId: String, communicationStyle: String });
const CreatorPersona = mongoose.model('CreatorPersona', personaSchema);

async function checkPersona() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const activeUser = '26784030441232364'; // The real user ID
        const persona = await CreatorPersona.findOne({ userId: activeUser });

        if (persona) {
            console.log('✅ Persona FOUND!');
            console.log('Style:', persona.communicationStyle);
        } else {
            console.log('❌ Persona NOT FOUND. This is why fallback is used.');
        }

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

checkPersona();
