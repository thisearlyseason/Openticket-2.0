import express from 'express';
const router = express.Router();
// import * as stripeWebhookController from '../controllers/stripeWebhookController.js';
// import * as stripeController from '../controllers/stripeController.js';

// import verifyToken from '../middlewares/authMiddleware.js';

router.get('/ping', (req, res) => res.json({ status: 'Stripe Route Active' }));

// router.post('/create-order', stripeController.createCheckoutSession);
// router.post('/refund', verifyToken, stripeController.processRefund);
// router.post('/request-payout', verifyToken, stripeController.requestPayout);
// router.post('/webhook', express.raw({ type: 'application/json' }), stripeWebhookController.handleWebhook);

export default router;
