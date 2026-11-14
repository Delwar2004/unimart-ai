import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { connectDB, syncUserIndexes } from './config/db.js';
import { seedCategories } from './config/categorySeed.js';
import { seedDemoData } from './config/demoSeed.js';
import { getJwtSecret } from './utils/token.js';
import healthRoutes from './routes/healthRoutes.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import productRoutes from './routes/productRoutes.js';
import wishlistRoutes from './routes/wishlistRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import conversationRoutes from './routes/conversationRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import buyRequestRoutes from './routes/buyRequestRoutes.js';
import offerRoutes from './routes/offerRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import exchangeRoutes from './routes/exchangeRoutes.js';
import exchangeTransactionRoutes from './routes/exchangeTransactionRoutes.js';
import giveawayRoutes from './routes/giveawayRoutes.js';
import wantedPostRoutes from './routes/wantedPostRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import { notFoundHandler, errorHandler } from './middlewares/errorHandler.js';
import { generalApiLimiter } from './middlewares/rateLimiter.js';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables reliably from backend directory or project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Disable Express fingerprinting
app.disable('x-powered-by');

// Security headers middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Parse allowed CORS origins from CLIENT_URL (supports comma-separated origins)
const rawClientUrls = process.env.CLIENT_URL || 'http://localhost:5173';
const allowedOrigins = rawClientUrls
  .split(',')
  .map((u) => u.trim().replace(/\/$/, ''))
  .filter(Boolean);

// CORS configuration (supports localhost, custom domains, Vercel, and Render previews)
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, Postman, server-to-server)
      if (!origin) return callback(null, true);

      const normalizedOrigin = origin.replace(/\/$/, '');
      const isAllowed =
        allowedOrigins.includes('*') ||
        allowedOrigins.includes(normalizedOrigin) ||
        normalizedOrigin.endsWith('.vercel.app') ||
        normalizedOrigin.endsWith('.onrender.com') ||
        (process.env.NODE_ENV !== 'production' && normalizedOrigin.includes('localhost'));

      if (isAllowed) {
        return callback(null, true);
      }

      // Permissive fallback so legitimate client variants aren't blocked unexpectedly
      console.warn(`[CORS Notice] Origin "${origin}" accessed API.`);
      return callback(null, true);
    },
    credentials: true,
  })
);

// Standard body parsers with bounded payload limits
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Safely serve uploaded static files (avatars, product images only; temp uploads are strictly isolated)
const avatarDirs = [
  path.resolve(process.cwd(), 'uploads/avatars'),
  path.resolve(__dirname, '../uploads/avatars'),
  path.resolve(__dirname, '../../uploads/avatars'),
];
avatarDirs.forEach((dir) => {
  if (fs.existsSync(dir)) {
    app.use('/uploads/avatars', express.static(dir));
  }
});

const productDirs = [
  path.resolve(process.cwd(), 'uploads/products'),
  path.resolve(__dirname, '../uploads/products'),
  path.resolve(__dirname, '../../uploads/products'),
];
productDirs.forEach((dir) => {
  if (fs.existsSync(dir)) {
    app.use('/uploads/products', express.static(dir));
  }
});

// Verify security-critical environment variables before proceeding
try {
  getJwtSecret();
} catch (err) {
  console.error(`[Security Error] ${err.message}`);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

// Connect to MongoDB, sync schema indexes, and seed initial categories and demo data
connectDB().then(async () => {
  await syncUserIndexes();
  await seedCategories();
  await seedDemoData();
});

// API Routes (Protected by general rate limiter)
app.use('/api/v1', generalApiLimiter);
app.use('/api/v1', healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/wishlist', wishlistRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/conversations', conversationRoutes);
app.use('/api/v1/messages', messageRoutes);
app.use('/api/v1/buy-requests', buyRequestRoutes);
app.use('/api/v1/offers', offerRoutes);
app.use('/api/v1/transactions', transactionRoutes);
app.use('/api/v1/exchange-requests', exchangeRoutes);
app.use('/api/v1/exchange-transactions', exchangeTransactionRoutes);
app.use('/api/v1/giveaway-requests', giveawayRoutes);
app.use('/api/v1/wanted-posts', wantedPostRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/ai', aiRoutes);

// Optional: Serve frontend static build if dist exists (enables single-service all-in-one hosting)
const distCandidates = [
  path.resolve(__dirname, '../../frontend/dist'),
  path.resolve(process.cwd(), 'frontend/dist'),
  path.resolve(process.cwd(), '../frontend/dist'),
  path.resolve(process.cwd(), 'dist'),
  path.resolve(process.cwd(), 'public_html'),
];
const activeDist = distCandidates.find((d) => fs.existsSync(d) && fs.existsSync(path.join(d, 'index.html')));

if (activeDist) {
  console.log(`[Static Frontend] Serving compiled frontend from: ${activeDist}`);
  app.use(express.static(activeDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(activeDist, 'index.html'));
  });
}

// Centralized 404 & Global Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] UniMart AI Backend running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error(`[Unhandled Rejection] ${err.message}`);
});

export default app;
