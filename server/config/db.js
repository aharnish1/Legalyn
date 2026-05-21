const mongoose = require('mongoose');

/**
 * Connect to MongoDB with retry logic.
 * Does NOT throw — logs errors and retries every 10s.
 *
 * NOTE: For Render deployment, whitelist 0.0.0.0/0 (or Render's
 * outbound IPs) in MongoDB Atlas Network Access. Render uses
 * dynamic IPs so a wide whitelist is required.
 */
async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('❌ MONGODB_URI is not set — cannot connect to database.');
    return null;
  }

  try {
    console.log('Connecting to MongoDB...');
    const conn = await mongoose.connect(uri);
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error('❌ MongoDB connection failed:');
    console.error('   ', error.message);
    if (error.message && error.message.includes('ENOTFOUND')) {
      console.error('   ⚠  DNS lookup failed — check your Atlas cluster hostname.');
    }
    if (error.message && error.message.includes('Authentication')) {
      console.error('   ⚠  Authentication failed — check your MongoDB username/password.');
    }
    if (error.message && error.message.includes('whitelist')) {
      console.error('   ⚠  IP not whitelisted — add 0.0.0.0/0 in Atlas Network Access.');
    }
    return null;
  }
}

/**
 * Start the MongoDB connection with automatic retry.
 * Server will keep running even if DB is temporarily unavailable.
 */
let retryCount = 0;
const MAX_RETRIES = Infinity; // keep retrying forever
const RETRY_DELAY = 10000; // 10 seconds

async function connectWithRetry() {
  const conn = await connectDB();

  if (conn) {
    retryCount = 0;
    return conn;
  }

  retryCount++;
  console.log(`\n⏳ Retrying MongoDB connection in ${RETRY_DELAY / 1000}s... (attempt ${retryCount})`);
  console.log('   Server will continue running while connection is retried.\n');

  return new Promise((resolve) => {
    setTimeout(async () => {
      const result = await connectWithRetry();
      resolve(result);
    }, RETRY_DELAY);
  });
}

module.exports = connectWithRetry;

// Register mongoose connection event listeners
mongoose.connection.on('connected', () => {
  console.log('🔌 MongoDB connection established.');
});

mongoose.connection.on('error', (err) => {
  console.error('🔌 MongoDB connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('🔌 MongoDB disconnected.');
});
