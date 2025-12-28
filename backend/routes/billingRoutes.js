import express from 'express';
const router = express.Router();

router.get('/ping', (req, res) => {
    res.json({ status: 'Billing Route Active' });
});

export default router;
