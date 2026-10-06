import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

import { connectDB, getDBStatus, isDBConnected } from './config/db.js';
import { seedData } from './seed.js';

import authRoutes from './routes/auth.routes.js';
import publicRoutes from './routes/public.routes.js';
import pricesRoutes from './routes/prices.routes.js';
import availabilityRoutes from './routes/availability.routes.js';
import galleryRoutes from './routes/gallery.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import enquiriesRoutes from './routes/enquiries.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Static file serving for images & uploads
const publicDir = path.resolve(process.cwd(), 'public');
const distDir = path.resolve(process.cwd(), 'dist');

if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.use('/images', express.static(path.join(publicDir, 'images')));
  app.use('/uploads', express.static(path.join(publicDir, 'uploads')));
}

// If dist exists, serve production frontend build
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
}

// API Router
const apiRouter = express.Router();

let seedRan = false;

// Ensure DB connection and initial structure are initialized for serverless / lambda invocations
apiRouter.use(async (req, res, next) => {
  if (!isDBConnected()) {
    try {
      await connectDB();
    } catch (_) {}
  }
  if (isDBConnected() && !seedRan) {
    seedRan = true;
    seedData().catch((err) => console.warn('[Seed] Warning:', err.message));
  }
  next();
});

apiRouter.get('/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'Yashwant Farm API',
    version: '2.0.0',
    db: getDBStatus(),
    time: new Date().toISOString()
  });
});

apiRouter.use('/auth', authRoutes);
apiRouter.use('/public', publicRoutes);
apiRouter.use('/prices', pricesRoutes);
apiRouter.use('/availability', availabilityRoutes);
apiRouter.use('/gallery', galleryRoutes);
apiRouter.use('/settings', settingsRoutes);
apiRouter.use('/enquiries', enquiriesRoutes);

// Mount API router across direct, proxied, and Netlify function routes
app.use('/api', apiRouter);
app.use('/.netlify/functions/api', apiRouter);

// SPA catch-all fallback for client-side routing
app.get('*', (req, res) => {
  const indexPath = path.join(distDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Frontend not built. Please run "npm run build" or start Vite dev server.');
  }
});

// Start Server and Connect DB

const startServer = async () => {
  try {
    await connectDB();
    await seedData();

    // Only start HTTP listener if not running in serverless Lambda/Netlify environment
    if (!process.env.NETLIFY && !process.env.AWS_LAMBDA_FUNCTION_NAME && process.env.NODE_ENV !== 'test') {
      app.listen(PORT, () => {
        console.log(`===============================================`);
        console.log(`  🌾 Yashwant Farm Backend Server Running      `);
        console.log(`  🚀 Port: http://localhost:${PORT}             `);
        console.log(`  🌿 Health: http://localhost:${PORT}/api/health`);
        console.log(`===============================================`);
      });
    }
  } catch (error) {
    console.error('Fatal error starting server:', error);
  }
};

startServer();

export default app;
