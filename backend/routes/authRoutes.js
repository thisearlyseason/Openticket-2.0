import express from 'express';
const router = express.Router();
import * as profileController from '../controllers/profileController.js';
import verifyToken from '../middlewares/authMiddleware.js';

// Special setup route (no auth required, but needs setup key)
router.post('/setup-admin', profileController.setupSuperAdmin);

router.post('/sync', verifyToken, profileController.syncProfile);
router.get('/me', verifyToken, profileController.getProfile);
router.put('/profiles/:id', verifyToken, profileController.updateProfile);
router.get('/profiles/:id', profileController.getProfileById);

export default router;
