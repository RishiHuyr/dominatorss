const mongoose = require('mongoose');
require('dotenv').config({ path: './server/.env' });
const User = require('./server/models/User');

async function testConnection() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const users = await User.find();
        console.log(`Found ${users.length} user(s) in DB.`);

        users.forEach(u => {
            console.log(`- User: ${u.username} (${u.githubId})`);
            console.log(`  Token Present: ${!!u.accessToken}`);
            console.log(`  Connected At: ${u.connectedAt}`);
        });

        await mongoose.connection.close();
    } catch (err) {
        console.error('❌ Test Failed:', err.message);
        process.exit(1);
    }
}

testConnection();
