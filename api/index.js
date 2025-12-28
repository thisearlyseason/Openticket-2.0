import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';

// Routes
import authRoutes from '../backend/routes/authRoutes.js';
import eventRoutes from '../backend/routes/eventRoutes.js';
import registrationRoutes from '../backend/routes/registrationRoutes.js';
import stripeRoutes from '../backend/routes/stripeRoutes.js';
import adminRoutes from '../backend/routes/adminRoutes.js';
import notificationRoutes from '../backend/routes/notificationRoutes.js';

// Controllers
import { handleWebhook } from '../backend/controllers/stripeWebhookController.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// 1. Enable CORS for all routes (this also handles preflight)
app.use(cors());

// Use JSON parser for all routes EXCEPT Stripe Webhook (needs raw buffer)
app.use((req, res, next) => {
    if (req.originalUrl.includes('/webhook')) {
        next();
    } else {
        express.json()(req, res, next);
    }
});

// Request logger
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    if (req.method === 'OPTIONS') {
        console.log('  Handling preflight...');
    }
    next();
});

// --- API ROUTES ---

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/debug', (req, res) => {
    res.json({
        env: {
            SUPABASE_URL: !!process.env.SUPABASE_URL,
            SUPABASE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
            FIREBASE_PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
            FIREBASE_CLIENT_EMAIL: !!process.env.FIREBASE_CLIENT_EMAIL,
            FIREBASE_PRIVATE_KEY: !!process.env.FIREBASE_PRIVATE_KEY,
            NODE_ENV: process.env.NODE_ENV,
            VITE_API_URL: process.env.VITE_API_URL
        },
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

// ALIAS: Mount webhook at /api/webhook to match the user's current CLI command.
app.post('/api/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err);
    // Ensure we always return JSON
    res.status(500).set('Content-Type', 'application/json').json({
        error: 'Internal Server Error',
        details: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// Export for Vercel Serverless
export default app;

// Only listen if run directly (local dev)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Openticket Backend running on port ${PORT}`);
    });
}
