const mongoose = require('mongoose');

global.isMongoAvailable = false;

// Disable Mongoose query buffering globally
mongoose.set('bufferCommands', false);
mongoose.set('bufferTimeoutMS', 500);

const connectDB = async () => {
  const primaryUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ai_blind_assistant';
  const localFallbackUri = 'mongodb://127.0.0.1:27017/ai_blind_assistant';

  try {
    const conn = await mongoose.connect(primaryUri, { serverSelectionTimeoutMS: 2000, bufferCommands: false });
    global.isMongoAvailable = true;
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    try {
      const fallbackConn = await mongoose.connect(localFallbackUri, { serverSelectionTimeoutMS: 1000, bufferCommands: false });
      global.isMongoAvailable = true;
      console.log(`MongoDB connected to local database: ${fallbackConn.connection.host}`);
    } catch (fallbackErr) {
      global.isMongoAvailable = false;
      console.warn('⚠️ Server running in Standalone In-Memory mode (MongoDB disconnected).');
    }
  }
};

module.exports = connectDB;