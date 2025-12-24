import express from 'express';
const router = express.Router();
import * as profileController from '../controllers/profileController.js';
import verifyToken from '../middlewares/authMiddleware.js';

router.post('/sync', verifyToken, profileController.syncProfile);
router.get('/me', verifyToken, profileController.getProfile);
router.put('/profiles/:id', verifyToken, profileController.updateProfile);
router.get('/profiles/:id', profileController.getProfileById);

export default router;
