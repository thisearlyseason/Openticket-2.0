const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

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
const authRoutes = require('../backend/routes/authRoutes');
const eventRoutes = require('../backend/routes/eventRoutes');
const registrationRoutes = require('../backend/routes/registrationRoutes');
const stripeRoutes = require('../backend/routes/stripeRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/stripe', stripeRoutes);

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Export for Vercel Serverless
module.exports = app;

// Only listen if run directly (local dev)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Openticket Backend running on port ${PORT}`);
    });
}
