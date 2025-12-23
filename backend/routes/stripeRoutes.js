const express = require('express');
const router = express.Router();
const stripeController = require('../controllers/stripeController');

router.post('/create-order', stripeController.createCheckoutSession);

module.exports = router;
