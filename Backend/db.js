const mongoose = require('mongoose');

global.isMongoAvailable = false;

// Disable Mongoose query buffering globally
mongoose.set('bufferCommands', false);
mongoose.set('bufferTimeoutMS', 1500);

const connectDB = async () => {
  const primaryUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ai_blind_assistant';
  const localFallbackUri = 'mongodb://127.0.0.1:27017/ai_blind_assistant';

  try {
    const conn = await mongoose.connect(primaryUri, { 
      serverSelectionTimeoutMS: 8000, 
      bufferCommands: false 
    });
    global.isMongoAvailable = true;
    const dbName = conn.connection.name || 'ai_blind_assistant';
    const host = conn.connection.host || 'MongoDB Atlas';
    console.log('====================================================');
    console.log('✅ DATABASE CONNECTION SUCCESSFUL!');
    console.log(`   Database Name : ${dbName}`);
    console.log(`   Cluster Host  : ${host}`);
    console.log('   Status        : Connected to MongoDB Database');
    console.log('====================================================');
  } catch (err) {
    try {
      const fallbackConn = await mongoose.connect(localFallbackUri, { 
        serverSelectionTimeoutMS: 2000, 
        bufferCommands: false 
      });
      global.isMongoAvailable = true;
      const dbName = fallbackConn.connection.name || 'ai_blind_assistant';
      console.log('====================================================');
      console.log('✅ DATABASE CONNECTION SUCCESSFUL (Local MongoDB)!');
      console.log(`   Database Name : ${dbName}`);
      console.log(`   Local Host    : ${fallbackConn.connection.host}`);
      console.log('   Status        : Connected to Local Database');
      console.log('====================================================');
    } catch (fallbackErr) {
      global.isMongoAvailable = false;
      console.warn('====================================================');
      console.warn('⚠️ DATABASE CONNECTION FAILED: Standalone In-Memory mode active.');
      console.warn(`   Reason: ${err.message}`);
      console.warn('====================================================');
    }
  }
};

module.exports = connectDB;