import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoMemoryInstance = null;

/**
 * Connect to MongoDB using Mongoose.
 * If external/local MongoDB is unreachable, gracefully falls back to an embedded in-memory MongoDB.
 */
export const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (uri) {
    try {
      const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 2500, // Timeout quickly if local server is down
      });

      const sanitizedHost = conn.connection.host;
      const dbName = conn.connection.name;
      console.log(`[Database] MongoDB connected successfully to host: ${sanitizedHost}, database: ${dbName}`);
      return;
    } catch (error) {
      console.warn(`[Database] Local/Configured MongoDB is unreachable (${error.message}).`);
    }
  }

  // Graceful fallback: In-memory MongoDB
  try {
    console.log('[Database] Initializing embedded in-memory MongoDB server for active session...');
    mongoMemoryInstance = await MongoMemoryServer.create();
    const memUri = mongoMemoryInstance.getUri();
    const conn = await mongoose.connect(memUri);
    console.log(`[Database] Embedded MongoDB connected successfully at: ${memUri}`);
  } catch (error) {
    console.error(`[Database Error] Failed to connect or start embedded MongoDB: ${error.message}`);
    console.warn('[Database] Server is running, but database-dependent features will fail gracefully.');
  }
};

/**
 * Safely ensure studentId unique sparse index without index conflict errors.
 * Inspects existing documents for duplicates before creating/updating index.
 * Never deletes or mutates user data.
 */
export const syncUserIndexes = async () => {
  try {
    if (mongoose.connection.readyState !== 1) return;
    const col = mongoose.connection.collection('users');

    // Check if duplicate non-null studentIds exist
    const duplicates = await col
      .aggregate([
        { $match: { studentId: { $exists: true, $ne: null, $ne: '' } } },
        { $group: { _id: '$studentId', count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
      ])
      .toArray();

    if (duplicates.length > 0) {
      console.warn(
        `[Database] Found ${duplicates.length} duplicate studentId value(s) in collection. Skipping automatic unique index creation to protect data integrity.`
      );
      return;
    }

    const existingIndexes = await col.indexes();
    const studentIdx = existingIndexes.find((i) => i.name === 'studentId_1');

    if (studentIdx && !studentIdx.unique) {
      console.log('[Database] Upgrading studentId_1 index to unique sparse index...');
      await col.dropIndex('studentId_1');
      await col.createIndex({ studentId: 1 }, { unique: true, sparse: true, name: 'studentId_1' });
      console.log('[Database] studentId_1 unique sparse index applied successfully.');
    } else if (!studentIdx) {
      await col.createIndex({ studentId: 1 }, { unique: true, sparse: true, name: 'studentId_1' });
      console.log('[Database] studentId_1 unique sparse index created.');
    }
  } catch (error) {
    console.warn(`[Database] User index verification notice: ${error.message}`);
  }
};

/**
 * Helper to get current database health status
 */
export const getDBStatus = () => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  const readyState = mongoose.connection.readyState;
  return {
    state: states[readyState] || 'unknown',
    isConnected: readyState === 1,
  };
};
