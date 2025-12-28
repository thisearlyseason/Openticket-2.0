import express from 'express';
const router = express.Router();

// Minimal ping route to verify connectivity/loading
router.get('/ping', (req, res) => {
    res.json({
        status: 'Payment Route Active',
        timestamp: new Date().toISOString()
    });
});

export default router;
