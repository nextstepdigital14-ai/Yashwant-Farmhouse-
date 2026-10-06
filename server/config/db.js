import mongoose from 'mongoose';
import dns from 'dns';
import dotenv from 'dotenv';
dotenv.config();

// Ensure SRV DNS records resolve reliably in local development
if (!process.env.NETLIFY && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  } catch (_) {}
}

const DEFAULT_ATLAS_URI = 'mongodb+srv://nextstepdigital:Manish5577@yashwant.indphwa.mongodb.net/yashwant?retryWrites=true&w=majority';
const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || DEFAULT_ATLAS_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'yashwant';

let cachedPromise = null;
let lastError = null;

// Disable command buffering so operations fail fast if DB is disconnected
mongoose.set('bufferCommands', false);

export const isDBConnected = () => mongoose.connection.readyState === 1;

export const connectDB = async () => {
  if (isDBConnected()) return mongoose.connection;
  if (cachedPromise) return cachedPromise;

  const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL || DEFAULT_ATLAS_URI;
  const timeoutMs = 15000;

  cachedPromise = mongoose.connect(mongoUri, {
    dbName: DB_NAME,
    serverSelectionTimeoutMS: timeoutMs,
    connectTimeoutMS: timeoutMs
  }).then((conn) => {
    lastError = null;
    console.log(`[MongoDB] Connected successfully. Database: ${conn.connection.name}`);
    return conn;
  }).catch((error) => {
    cachedPromise = null;
    lastError = error.message;
    console.warn(`[MongoDB] Database offline (${error.message}). Using high-performance memory store fallback.`);
  });

  return cachedPromise;
};

export const getDBStatus = () => {
  return {
    connected: isDBConnected(),
    readyState: mongoose.connection.readyState,
    host: isDBConnected() ? (mongoose.connection.host || 'connected') : 'memory-fallback',
    database: isDBConnected() ? mongoose.connection.name : DB_NAME,
    hasMongoUriEnv: Boolean(process.env.MONGODB_URI || process.env.DATABASE_URL),
    lastError: lastError
  };
};

