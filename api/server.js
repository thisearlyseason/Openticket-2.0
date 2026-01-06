import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';

// Routes - FULLY ENABLED
import authRoutes from '../backend/routes/authRoutes.js';
import eventRoutes from '../backend/routes/eventRoutes.js';
import registrationRoutes from '../backend/routes/registrationRoutes.js';
import adminRoutes from '../backend/routes/adminRoutes.js';
import notificationRoutes from '../backend/routes/notificationRoutes.js';
import pushRoutes from '../backend/routes/pushRoutes.js';
import emailRoutes from '../backend/routes/emailRoutes.js';

// Controllers
import { handleWebhook } from '../backend/controllers/stripeWebhookController.js';

// Services
import { initCronJobs } from '../backend/services/cronService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// CORS configuration - Allow all for now during debug
app.use(cors({ origin: true, credentials: true }));

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

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/debug', (req, res) => {
    try {
        res.json({
            env: {
                SUPABASE_URL: !!process.env.SUPABASE_URL,
                SUPABASE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
                FIREBASE_PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
                FIREBASE_CLIENT_EMAIL: !!process.env.FIREBASE_CLIENT_EMAIL,
                FIREBASE_PRIVATE_KEY: !!process.env.FIREBASE_PRIVATE_KEY,
                NODE_ENV: process.env.NODE_ENV,
                VERCEL: process.env.VERCEL
            },
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        });
    } catch (e) {
        res.status(500).send(`Debug Error: ${e.message}`);
    }
});

app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/registrations', registrationRoutes);

app.get('/api/check', (req, res) => {
    res.json({ status: 'Check Route Active' });
});

// app.use('/api/billing', billingRoutes); // REPLACEMENT ROUTE - REMOVED
import stripeRoutes from '../backend/routes/stripeRoutes.js';
import subscriptionRoutes from '../backend/routes/subscriptionRoutes.js';
app.use('/api/stripe', stripeRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/admin', adminRoutes);

// notificationRoutes already imported at top
app.use('/api/notifications', notificationRoutes);

// Push notification routes
app.use('/api/push', pushRoutes);

// Email delivery routes
app.use('/api/email', emailRoutes);

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
