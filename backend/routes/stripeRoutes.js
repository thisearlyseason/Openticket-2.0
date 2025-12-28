import express from 'express';
const router = express.Router();
import * as stripeWebhookController from '../controllers/stripeWebhookController.js';
import * as stripeController from '../controllers/stripeController.js';

import verifyToken from '../middlewares/authMiddleware.js';

router.post('/create-order', stripeController.createCheckoutSession);
router.post('/refund', verifyToken, stripeController.processRefund);
router.post('/request-payout', verifyToken, stripeController.requestPayout);
// Webhook route - middleware for raw body handled in index.js usually, or here?
// Usually index.js applies json() globally. We need raw() for webhook.
// The user's index.js likely applies json() globally. We might need to adjust index.js or use a specific middleware here.
// For now, let's mount it and assume index.js needs adjustment.
router.post('/webhook', express.raw({ type: 'application/json' }), stripeWebhookController.handleWebhook);

export default router;
