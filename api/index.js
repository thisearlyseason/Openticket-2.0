import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// 1. Enable CORS for all routes (this also handles preflight)
app.use(cors());

app.use(express.json());

// Request logger
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    if (req.method === 'OPTIONS') {
        console.log('  Handling preflight...');
    }
    next();
});

// --- ROUTES ---
// --- ROUTES ---
import authRoutes from '../backend/routes/authRoutes.js';
import eventRoutes from '../backend/routes/eventRoutes.js';
import registrationRoutes from '../backend/routes/registrationRoutes.js';
import stripeRoutes from '../backend/routes/stripeRoutes.js';

app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/stripe', stripeRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Export for Vercel Serverless
export default app;

// Only listen if run directly (local dev)
import { fileURLToPath } from 'url';

// Only listen if run directly (local dev)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    app.listen(PORT, () => {
        console.log(`Openticket Backend running on port ${PORT}`);
    });
}
