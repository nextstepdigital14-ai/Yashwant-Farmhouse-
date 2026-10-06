import mongoose from 'mongoose';
import dns from 'dns';
import dotenv from 'dotenv';
dotenv.config();

// Ensure SRV DNS records resolve reliably on all platforms
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (_) {}

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/yashwant_farm';
const DB_NAME = process.env.MONGODB_DB_NAME || 'yashwant';

let cachedPromise = null;

// Disable command buffering so operations fail fast if DB is disconnected
mongoose.set('bufferCommands', false);

export const isDBConnected = () => mongoose.connection.readyState === 1;

export const connectDB = async () => {
  if (isDBConnected()) return mongoose.connection;
  if (cachedPromise) return cachedPromise;

  const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/yashwant_farm';
  const timeoutMs = process.env.MONGODB_URI ? 15000 : 2500;

  cachedPromise = mongoose.connect(mongoUri, {
    dbName: DB_NAME,
    serverSelectionTimeoutMS: timeoutMs,
    connectTimeoutMS: timeoutMs
  }).then((conn) => {
    console.log(`[MongoDB] Connected successfully. Database: ${conn.connection.name}`);
    return conn;
  }).catch((error) => {
    cachedPromise = null;
    console.warn(`[MongoDB] Database offline (${error.message}). Using high-performance memory store fallback.`);
  });

  return cachedPromise;
};

export const getDBStatus = () => {
  return {
    connected: isDBConnected(),
    readyState: mongoose.connection.readyState,
    host: isDBConnected() ? (mongoose.connection.host || 'connected') : 'memory-fallback',
    database: isDBConnected() ? mongoose.connection.name : DB_NAME
  };
};

