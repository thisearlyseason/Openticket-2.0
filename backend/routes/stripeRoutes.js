import express from 'express';
const router = express.Router();
import * as stripeController from '../controllers/stripeController.js';
import verifyToken from '../middlewares/authMiddleware.js';

router.post('/create-order', stripeController.createOrder);
router.post('/create-portal-session', verifyToken, stripeController.createPortalSession);

export default router;
