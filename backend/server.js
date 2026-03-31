import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './src/routes/auth.js';
import sitesRoutes from './src/routes/sites.js';
import pagesRoutes from './src/routes/pages.js';
import mediaRoutes from './src/routes/media.js';
import buildRoutes from './src/routes/build.js';
import deployRoutes from './src/routes/deploy.js';
import aiRoutes from './src/routes/ai.js';
import usersRoutes from './src/routes/users.js';
import adminRoutes from './src/routes/admin.js';
import { errorHandler } from './src/middleware/errorHandler.js';
import { startBillingCron } from './src/cron/billing-cron.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3005;
app.set('trust proxy', 1);

// Security
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'", "data:"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      frameSrc: ["'self'", "https://www.google.com", "https://maps.google.com"],
    },
  },
}));
app.use(mongoSanitize());
app.use(compression());

// Rate limiting
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Strict rate limit on login
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives, réessayez dans 15 minutes' },
}));

// CORS
const corsOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
if (!corsOrigins.length) console.warn('[security] CORS_ORIGINS not set — defaulting to same-origin only');
app.use(cors({
  origin: corsOrigins.length ? corsOrigins : false,
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, process.env.UPLOAD_DIR || './uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/sites', sitesRoutes);
app.use('/api/pages', pagesRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/build', buildRoutes);
app.use('/api/deploy', deployRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', async (req, res) => {
  const dbState = mongoose.connection.readyState;
  res.json({
    status: dbState === 1 ? 'ok' : 'degraded',
    mongodb: ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState],
    uptime: process.uptime(),
    memory: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
  });
});

// Error handler
app.use(errorHandler);

// MongoDB connection & server start
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
    startBillingCron();
    app.listen(PORT, () => console.log(`Resamatic API running on port ${PORT}`));
  })
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down...');
  await mongoose.connection.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;
