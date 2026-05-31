import 'dotenv/config';
import path from 'path';
import dotenv from 'dotenv';

// Load .env from root if in development
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
}

import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import routes from './routes';
import {
  sanitizeBody,
  detectSQLInjection,
  requireJSON,
  securityHeaders,
} from './middlewares/security';

const app: Express = express();
const PORT = parseInt(process.env.PORT ?? '4000', 10);

// Trust Railway's proxy (required for correct IP in rate limiting)
app.set('trust proxy', 1);

// Security headers
app.use(helmet({ crossOriginEmbedderPolicy: false, contentSecurityPolicy: false }));
app.use(securityHeaders);

// CORS - strict allowlist for production, flexible for development
const isDev = process.env.NODE_ENV !== 'production';
const ALLOWED_ORIGINS = (process.env.FRONTEND_URL ?? '')
  .split(',').map((s) => s.trim()).filter(Boolean)
  .concat(['http://localhost:5173']); // Vite default

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests without origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    // Check if in allowed list
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    
    // In development, allow any localhost port
    if (isDev && origin.startsWith('http://localhost:')) return callback(null, true);
    
    // Block everything else
    callback(new Error(`CORS: ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));

// Global rate limiter
app.use(rateLimit({
  windowMs: 60_000, max: 500, standardHeaders: true, legacyHeaders: false,
  message: { success: false, error: 'Too many requests' },
  skip: (req) => req.path === '/health',
}));

// Strict auth limits
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60_000, max: 10, message: { success: false, error: 'Too many login attempts. Try again in 15 minutes.' } }));
app.use('/api/auth/signup', rateLimit({ windowMs: 60 * 60_000, max: 5, message: { success: false, error: 'Too many signup attempts.' } }));

// Compression
app.use(compression({ threshold: 1024 }));

// Body / Cookie parsing
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(requireJSON);

// Input sanitization (defense in depth after Zod)
app.use(sanitizeBody);
app.use(detectSQLInjection);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), pid: process.pid, uptime: Math.round(process.uptime()) });
});

// API routes
app.use('/api', routes);

// 404
app.use((_req, res) => res.status(404).json({ success: false, error: 'Route not found' }));

// Error handler - never leaks stack traces in production
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const isDev = process.env.NODE_ENV !== 'production';
  console.error('[error]', err.message, isDev ? err.stack : '');
  res.status(500).json({ success: false, error: isDev ? err.message : 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ API worker ${process.pid} running on port ${PORT}`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV ?? 'development'}`);
});

export default app;
