import express from 'express';
const router = express.Router();
import * as stripeController from '../controllers/stripeController.js';
import * as stripeConnectController from '../controllers/stripeConnectController.js';
import * as stripeWebhookController from '../controllers/stripeWebhookController.js';
import verifyToken from '../middlewares/authMiddleware.js';
import { checkoutRateLimiter } from '../middleware/rateLimiter.js';

// ========== WEBHOOK ROUTES (Must be FIRST - before other middleware) ==========
// Webhooks use raw body for signature verification, so they bypass auth/CSRF
router.post('/webhook', stripeWebhookController.handleWebhook);

// ========== CHECKOUT ROUTES ==========
// ✅ FIX: Apply rate limiting to checkout endpoints
router.post('/create-order', checkoutRateLimiter, stripeController.createOrder);
router.post('/create-portal-session', verifyToken, stripeController.createPortalSession);
router.post('/create-payment-intent', verifyToken, checkoutRateLimiter, stripeController.createPaymentIntent);
router.post('/calculate-order', stripeController.calculateOrder);
router.post('/verify-session', stripeController.verifySession);

// ========== CURRENCY ROUTES ==========
router.get('/exchange-rates', stripeController.getExchangeRates);
router.post('/convert-price', stripeController.convertPrice);

// ========== AT-DOOR PAYMENT ROUTES ==========
router.post('/record-at-door-payment', verifyToken, stripeController.recordAtDoorPayment);
router.post('/at-door/create-payment-intent', stripeController.createAtDoorPaymentIntent);
router.post('/at-door/confirm-payment', stripeController.confirmAtDoorPayment);
router.post('/create-door-session', verifyToken, stripeController.createDoorCheckoutSession);

// ========== STRIPE CONNECT ROUTES ==========
router.post('/connect/create-account', verifyToken, stripeConnectController.createConnectAccount);
router.get('/connect/status', verifyToken, stripeConnectController.getConnectStatus);
router.post('/connect/create-link', verifyToken, stripeConnectController.createAccountLink);
router.post('/connect/dashboard-link', verifyToken, stripeConnectController.createDashboardLink);
router.post('/connect/disconnect', verifyToken, stripeConnectController.disconnectAccount);

// ========== REFUND SYNC (Admin: re-process past Stripe refunds) ==========
router.post('/sync-refunds', verifyToken, stripeWebhookController.syncStripeRefunds);

// ========== ORGANIZER PAYOUT REQUEST ==========
router.post('/request-payout', verifyToken, stripeController.requestPayout);

export default router;
