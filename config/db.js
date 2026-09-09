const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

let mongodInstance = null;

const connectDB = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/digital_library_db';

  try {
    // Attempt standard connection to MongoDB with 1.5s timeout
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 1500
    });
    console.log(`[MongoDB] Connected successfully to: ${mongoose.connection.host}/${mongoose.connection.name}`);
  } catch (primaryErr) {
    console.warn(`[MongoDB] Primary database at '${uri}' unreachable (${primaryErr.message}).`);
    console.log('[MongoDB] Launching embedded persistent database instance (.mongo-data)...');

    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const dbPath = path.join(__dirname, '../.mongo-data');
      if (!fs.existsSync(dbPath)) {
        fs.mkdirSync(dbPath, { recursive: true });
      }

      // Clear any stale lock file from previous abnormal termination
      const lockFile = path.join(dbPath, 'mongod.lock');
      if (fs.existsSync(lockFile)) {
        try {
          fs.unlinkSync(lockFile);
        } catch (e) {
          // Lock might be in use or protected
        }
      }

      mongodInstance = await MongoMemoryServer.create({
        instance: {
          dbPath: dbPath,
          storageEngine: 'wiredTiger',
          launchTimeout: 60000
        }
      });

      const memoryUri = mongodInstance.getUri();
      await mongoose.connect(memoryUri);
      console.log(`[MongoDB] Connected to embedded database instance: ${memoryUri}`);
    } catch (memErr) {
      console.warn('[MongoDB] Embedded disk storage failed, attempting pure in-memory instance...', memErr.message);
      try {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        mongodInstance = await MongoMemoryServer.create({
          instance: { launchTimeout: 60000 }
        });
        await mongoose.connect(mongodInstance.getUri());
        console.log(`[MongoDB] Connected to in-memory database instance: ${mongodInstance.getUri()}`);
      } catch (fatalErr) {
        console.error('[MongoDB] Fatal: Failed to start database:', fatalErr.message);
        process.exit(1);
      }
    }
  }

  mongoose.connection.on('disconnected', () => {
    console.warn('[MongoDB] Database connection disconnected.');
  });
};

const disconnectDB = async () => {
  await mongoose.disconnect();
  if (mongodInstance) {
    await mongodInstance.stop();
  }
};

module.exports = {
  connectDB,
  disconnectDB
};
