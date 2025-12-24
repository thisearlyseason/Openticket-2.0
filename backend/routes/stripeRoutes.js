import express from 'express';
const router = express.Router();
import * as stripeController from '../controllers/stripeController.js';

router.post('/create-order', stripeController.createCheckoutSession);

export default router;
