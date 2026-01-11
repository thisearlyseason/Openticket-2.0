import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import path from 'path';

// Load environment variables - check both locations
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// First load from /app/.env (root)
dotenv.config({ path: path.resolve(__dirname, '../.env') });
// Then load from /app/backend/.env (will override if same keys exist)
dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });

// Log Resend configuration status
console.log('[Server] RESEND_API_KEY configured:', !!process.env.RESEND_API_KEY);
console.log('[Server] SENDER_EMAIL:', process.env.SENDER_EMAIL || 'not set');

// Routes - FULLY ENABLED
import authRoutes from '../backend/routes/authRoutes.js';
import eventRoutes from '../backend/routes/eventRoutes.js';
import registrationRoutes from '../backend/routes/registrationRoutes.js';
import adminRoutes from '../backend/routes/adminRoutes.js';
import notificationRoutes from '../backend/routes/notificationRoutes.js';
import pushRoutes from '../backend/routes/pushRoutes.js';
import emailRoutes from '../backend/routes/emailRoutes.js';
import analyticsRoutes from '../backend/routes/analyticsRoutes.js';
import waitlistRoutes from '../backend/routes/waitlistRoutes.js';
import enterpriseRoutes from '../backend/routes/enterpriseRoutes.js';
import onboardingRoutes from '../backend/routes/onboardingRoutes.js';
import uploadRoutes from '../backend/routes/uploadRoutes.js';

// Controllers
import { handleWebhook } from '../backend/controllers/stripeWebhookController.js';

// Services
import { initCronJobs } from '../backend/services/cronService.js';

const app = express();
const PORT = process.env.PORT || 5001;

// Trust proxy - required for rate limiting behind reverse proxy (Kubernetes/nginx)
app.set('trust proxy', 1);

// ==================== CORS CONFIGURATION ====================
// Production whitelist - add your production domains here
const allowedOrigins = [
    'https://openticket.events',
    'https://www.openticket.events',
    'https://app.openticket.events',
    // Preview/Development domains
    /\.preview\.emergentagent\.com$/,
    /localhost:\d+$/,
    /127\.0\.0\.1:\d+$/
];

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        
        // Check against whitelist
        const isAllowed = allowedOrigins.some(allowed => {
            if (allowed instanceof RegExp) {
                return allowed.test(origin);
            }
            return allowed === origin;
        });
        
        if (isAllowed) {
            callback(null, true);
        } else {
            console.warn(`[CORS] Blocked request from unauthorized origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// ==================== RATE LIMITING ====================

// Rate limiter options - disable X-Forwarded-For validation as we trust the proxy
const rateLimitOptions = {
    standardHeaders: true,
    legacyHeaders: false,
    validate: false // Disable all validations to prevent errors in proxy environments
};

// General API rate limiter - 500 requests per 15 minutes
const generalLimiter = rateLimit({
    ...rateLimitOptions,
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // limit each IP to 500 requests per window
    message: { error: 'Too many requests, please try again later.' },
    skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/api/ping' || req.path === '/api/health';
    }
});

// Strict rate limiter for auth endpoints - 10 requests per minute
const authLimiter = rateLimit({
    ...rateLimitOptions,
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 attempts per minute
    message: { error: 'Too many authentication attempts. Please try again in a minute.' }
});

// Strict rate limiter for password changes - 5 requests per 15 minutes
const passwordLimiter = rateLimit({
    ...rateLimitOptions,
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per 15 minutes
    message: { error: 'Too many password change attempts. Please try again later.' }
});

// Apply general rate limiter to all API routes
app.use('/api/', generalLimiter);

// Webhook parsing needs RAW body, handled in specific route or before global JSON
// CRITICAL: Must be BEFORE express.json() to preserve signature
app.post('/api/webhook', express.raw({ type: 'application/json' }), handleWebhook);

app.use(express.json());

// Request logger
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    if (req.method === 'OPTIONS') {
        console.log('  Handling preflight...');
    }
    next();
});

// --- API ROUTES ---

app.get('/api/ping', (req, res) => {
    res.send('pong');
});

// Health check endpoint (safe for production)
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/auth/change-password', passwordLimiter); // Extra strict for password changes
app.use('/api/events', eventRoutes);
app.use('/api/registrations', registrationRoutes);

app.get('/api/check', (req, res) => {
    res.json({ status: 'Check Route Active' });
});

// app.use('/api/billing', billingRoutes); // REPLACEMENT ROUTE - REMOVED
import stripeRoutes from '../backend/routes/stripeRoutes.js';
app.use('/api/stripe', stripeRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/admin', adminRoutes);

// notificationRoutes already imported at top
app.use('/api/notifications', notificationRoutes);

// Push notification routes
app.use('/api/push', pushRoutes);

// Email delivery routes
app.use('/api/email', emailRoutes);

// Waitlist routes
app.use('/api/waitlist', waitlistRoutes);

// Enterprise contact routes
app.use('/api/enterprise', enterpriseRoutes);

// Waitlist routes
app.use('/api/waitlist', waitlistRoutes);

// Enterprise contact routes
app.use('/api/enterprise', enterpriseRoutes);

// Onboarding routes
app.use('/api/onboarding', onboardingRoutes);

// Upload routes (document storage)
app.use('/api/upload', uploadRoutes);

// ALIAS: Mount webhook at /api/webhook to match the user's current CLI command.
// ALIAS: Webhook mounted at top.

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('CRITICAL ERROR:', err);
    // Return a Very Descriptive Plain Text error if JSON fails
    const errorDetails = {
        message: err.message,
        stack: err.stack,
        code: err.code
    };

    res.status(500).setHeader('Content-Type', 'text/plain').send(`
        INTERNAL SERVER ERROR
        =====================
        Message: ${err.message}
        Code: ${err.code || 'N/A'}
        Details: ${JSON.stringify(errorDetails, null, 2)}
    `);
});

// Export for Vercel Serverless
export default app;

// Start server for local development
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 OpenTicket API Server running on http://0.0.0.0:${PORT}`);
        // Initialize cron jobs after server starts
        initCronJobs();
    });
}

// FORCE REBUILD: 2025-12-28 - Lazy Load Fix v2
