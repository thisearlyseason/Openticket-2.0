import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import csrf from 'csurf';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import path from 'path';
import http from 'http';

// Load environment variables - check both locations
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// First load from /app/.env (root, lower priority)
dotenv.config({ path: path.resolve(__dirname, '../.env') });
// Then load from /app/backend/.env (higher priority - overrides root .env)
dotenv.config({ path: path.resolve(__dirname, '../backend/.env'), override: true });

// Log Resend configuration status
console.log('[Server] RESEND_API_KEY configured:', !!process.env.RESEND_API_KEY);
console.log('[Server] SENDER_EMAIL:', process.env.SENDER_EMAIL || 'not set');
console.log('[Server] FRONTEND_URL:', process.env.FRONTEND_URL || 'NOT SET');

// Load platform settings from DB (overrides env vars if set via admin UI)
const loadPlatformSettingsFromDB = async () => {
    try {
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        const { data, error } = await supabase
            .from('platform_settings')
            .select('value')
            .eq('key', 'stripe_config')
            .single();
        if (error && (error.message?.includes('does not exist') || error.message?.includes('schema cache'))) {
            console.log('[Server] platform_settings table not yet created - using env vars');
            return;
        }
        if (data?.value) {
            const cfg = data.value;
            if (cfg.secretKey) process.env.STRIPE_SECRET_KEY = cfg.secretKey;
            if (cfg.publishableKey) process.env.VITE_STRIPE_PUBLISHABLE_KEY = cfg.publishableKey;
            if (cfg.webhookSecret) process.env.STRIPE_WEBHOOK_SECRET = cfg.webhookSecret;
            console.log('[Server] Loaded Stripe settings from database (overrides env vars)');
        }
    } catch (e) {
        // Ignore errors - use env vars as fallback
        console.log('[Server] Platform settings not in DB, using env vars');
    }
};
loadPlatformSettingsFromDB();

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
import subscriptionRoutes from '../backend/routes/subscriptionRoutes.js';
import settingsRoutes from '../backend/routes/settingsRoutes.js';
import platformSettingsRoutes from '../backend/routes/platformSettingsRoutes.js';
import smmRoutes from '../backend/routes/smmRoutes.js';
import kioskRoutes from '../backend/routes/kioskRoutes.js';

// Controllers
import { handleWebhook } from '../backend/controllers/stripeWebhookController.js';

// Services
import { initCronJobs } from '../backend/services/cronService.js';
import websocketService from '../backend/services/websocketService.js';

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 5001;

// Trust proxy - required for rate limiting behind reverse proxy (Kubernetes/nginx)
app.set('trust proxy', 1);

// ==================== CORS CONFIGURATION ====================
// Production whitelist - add your production domains here
const allowedOrigins = [
    'https://openticket.events',
    'https://www.openticket.events',
    'https://app.openticket.events',
    // Vercel preview deployments (branch deployments)
    /\.vercel\.app$/,
    /openticket.*\.vercel\.app$/,
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
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token']
};

app.use(cors(corsOptions));

// ==================== SECURITY HEADERS (Helmet) ====================
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com", "https://www.googletagmanager.com"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: [
                "'self'", 
                "https://*.supabase.co", 
                "https://api.stripe.com",
                "https://*.googleapis.com",
                "https://*.firebaseio.com"
            ],
            frameSrc: ["'self'", "https://js.stripe.com"],
            fontSrc: ["'self'", "data:", "https:"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'", "blob:", "data:"],
            workerSrc: ["'self'", "blob:"]
        }
    },
    crossOriginEmbedderPolicy: false, // Required for some third-party embeds
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Required for CDN assets
    hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
    }
}));

console.log('[Security] ✅ Helmet security headers enabled');

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

// ========== PAYMENT ENDPOINT RATE LIMITER (SECURITY) ==========
// CRITICAL: Prevent card testing attacks and payment abuse
const paymentLimiter = rateLimit({
    ...rateLimitOptions,
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Only 10 payment attempts per 15 min per IP
    message: { 
        error: 'Too many payment attempts. Please try again in 15 minutes.',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Log suspicious activity
    handler: (req, res) => {
        console.error('[Security] Payment rate limit exceeded', {
            ip: req.ip,
            path: req.path,
            timestamp: new Date().toISOString()
        });
        res.status(429).json({
            error: 'Too many payment attempts. Please try again in 15 minutes.',
            code: 'RATE_LIMIT_EXCEEDED'
        });
    }
});

// Permissive limiter for calculate-order (called on every ticket quantity change)
const calculateOrderLimiter = rateLimit({
    ...rateLimitOptions,
    windowMs: 60 * 1000, // 1 minute
    max: 120, // 120 fee-preview requests per minute per IP
    message: { error: 'Too many fee calculation requests, please slow down.', code: 'RATE_LIMIT_EXCEEDED' },
    standardHeaders: true,
    legacyHeaders: false,
});

console.log('[Security] ✅ Payment rate limiting configured (10 req/15min), calculate-order: 120 req/min');
// ========== END PAYMENT RATE LIMITER ==========

// Apply general rate limiter to all API routes
app.use('/api/', generalLimiter);

// Webhook parsing needs RAW body, handled in specific route or before global JSON
// CRITICAL: Must be BEFORE express.json() to preserve signature
app.post('/api/webhook', express.raw({ type: 'application/json' }), handleWebhook);
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// Increase JSON body limit to handle base64 encoded files (e.g., nonprofit documents)
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));

// ==================== CSRF PROTECTION ====================
// Enable cookie parsing for CSRF tokens
app.use(cookieParser());

// Configure CSRF protection
const csrfProtection = csrf({ 
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        sameSite: 'strict',
        maxAge: 3600000 // 1 hour
    }
});

// CSRF token endpoint (public, no auth required)
app.get('/api/csrf-token', csrfProtection, (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});

// Apply CSRF protection to all state-changing routes
// Exclude: GET requests, webhooks, public endpoints
const csrfMiddleware = (req, res, next) => {
    // Skip CSRF for safe methods and webhooks
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
        return next();
    }
    
    // Log for debugging
    console.log('[CSRF] Checking path:', req.path, 'Original URL:', req.originalUrl);
    
    // Skip CSRF for webhook endpoints (match both path formats)
    if (req.path === '/webhook' || req.path === '/stripe/webhook' || 
        req.originalUrl === '/api/webhook' || req.originalUrl === '/api/stripe/webhook') {
        console.log('[CSRF] Skipping - webhook endpoint');
        return next();
    }
    
    // Skip CSRF for analytics tracking (non-critical)
    if (req.path === '/analytics/track' || req.originalUrl === '/api/analytics/track') {
        console.log('[CSRF] Skipping - analytics endpoint');
        return next();
    }
    
    // Skip CSRF for Stripe order endpoints (they use Stripe's own security)
    if (req.path === '/stripe/calculate-order' || req.path === '/stripe/create-order' ||
        req.path === '/stripe/verify-session' || req.path === '/stripe/sync-refunds' ||
        req.path === '/stripe/request-payout' ||
        req.originalUrl === '/api/stripe/calculate-order' || req.originalUrl === '/api/stripe/create-order' ||
        req.originalUrl === '/api/stripe/verify-session' || req.originalUrl === '/api/stripe/sync-refunds' ||
        req.originalUrl === '/api/stripe/request-payout' ||
        req.path.startsWith('/stripe/payment-intent/') || req.originalUrl.startsWith('/api/stripe/payment-intent/')) {
        console.log('[CSRF] Skipping - Stripe order endpoint');
        return next();
    }
    
    // Skip CSRF for public event views (read-only)
    if (req.path.startsWith('/events/') && req.method === 'GET') {
        return next();
    }
    
    console.log('[CSRF] Applying CSRF protection');
    // Apply CSRF protection to everything else
    return csrfProtection(req, res, next);
};

app.use('/api/', csrfMiddleware);

console.log('[Security] ✅ CSRF protection enabled');
// ==================== END CSRF PROTECTION ====================

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

// Debug endpoint to check environment
app.get('/api/debug-env', (req, res) => {
    res.json({
        frontendUrl: process.env.FRONTEND_URL || 'NOT SET',
        nodeEnv: process.env.NODE_ENV,
        port: process.env.PORT
    });
});

// Request logger for debugging
app.use((req, res, next) => {
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    }
    next();
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
// Apply payment rate limiter to ALL Stripe endpoints (SECURITY)
// Apply rate limiters per stripe route type:
// - calculate-order: permissive (called on every qty change)
// - All other stripe routes: strict payment limiter
app.use('/api/stripe/calculate-order', calculateOrderLimiter);
app.use('/api/stripe', paymentLimiter, stripeRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/admin', adminRoutes);

// notificationRoutes already imported at top
app.use('/api/notifications', notificationRoutes);

// Push notification routes
app.use('/api/push', pushRoutes);

// Email delivery routes
app.use('/api/email', emailRoutes);

// Analytics routes
app.use('/api/analytics', analyticsRoutes);

// Waitlist routes
app.use('/api/waitlist', waitlistRoutes);

// Enterprise contact routes
app.use('/api/enterprise', enterpriseRoutes);

// Presale routes
import presaleRoutes from '../backend/routes/presaleRoutes.js';
app.use('/api/presale', presaleRoutes);

// Onboarding routes
app.use('/api/onboarding', onboardingRoutes);

// Upload routes (document storage)
app.use('/api/upload', uploadRoutes);

// Settings routes (global admin settings)
app.use('/api/settings', settingsRoutes);

// Platform settings - admin only, for system-wide configuration  
app.use('/api/platform-settings', platformSettingsRoutes);

// Kiosk routes (event-scoped kiosk mode)
app.use('/api/kiosk', kioskRoutes);

// SMM (Social Media Management) routes
app.use('/api/smm', smmRoutes);

// SMM Admin Utilities
import smmAdminUtils from '../backend/routes/smmAdminUtils.js';
app.use('/api/smm', smmAdminUtils);

// SMM Manual Fix Utility
import smmManualFix from '../backend/routes/smmManualFix.js';
app.use('/api/smm', smmManualFix);

// AI Routes (Image generation with Nano Banana)
import aiRoutes from '../backend/routes/aiRoutes.js';
app.use('/api/ai', aiRoutes);

// Ticket lookup routes (Find My Tickets)
import ticketLookupRoutes from '../backend/routes/ticketLookupRoutes.js';
app.use('/api/tickets', ticketLookupRoutes);

// ALIAS: Mount webhook at /api/webhook to match the user's current CLI command.
// ALIAS: Webhook mounted at top.

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('CRITICAL ERROR:', err);
    
    // Don't override if response already sent by controller
    if (res.headersSent) {
        return next(err);
    }

    // Return JSON for API routes, plain text for others
    const errorDetails = {
        error: err.message || 'Internal Server Error',
        code: err.code || 'UNKNOWN',
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    };

    // API routes should return JSON
    if (req.path.startsWith('/api/')) {
        return res.status(err.status || 500).json(errorDetails);
    }

    // Non-API routes get plain text
    res.status(500).setHeader('Content-Type', 'text/plain').send(`
        INTERNAL SERVER ERROR
        =====================
        Message: ${err.message}
        Code: ${err.code || 'N/A'}
    `);
});

// Export for Vercel Serverless
export default app;

// Start server for local development
if (process.env.NODE_ENV !== 'production') {
    httpServer.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 OpenTicket API Server running on http://0.0.0.0:${PORT}`);
        
        // Initialize WebSocket service
        websocketService.initialize(httpServer);
        console.log('[Server] ✅ WebSocket service initialized');
        
        // Initialize cron jobs after server starts
        initCronJobs();
    });
}

// FORCE REBUILD: 2025-12-28 - Lazy Load Fix v2
