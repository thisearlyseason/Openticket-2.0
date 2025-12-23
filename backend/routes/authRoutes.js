const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const verifyToken = require('../middlewares/authMiddleware');

router.post('/sync', verifyToken, profileController.syncProfile);
router.get('/me', verifyToken, profileController.getProfile);
router.get('/profiles/:id', profileController.getProfileById);

module.exports = router;
