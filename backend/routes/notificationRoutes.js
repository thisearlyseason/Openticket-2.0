import express from 'express';
const router = express.Router();

router.get('/:userId', (req, res) => {
    // Return empty notifications for now to silence errors
    res.json({ notifications: [] });
});

export default router;
