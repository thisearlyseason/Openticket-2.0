import express from 'express';
const router = express.Router();
import * as registrationController from '../controllers/registrationController.js';
import verifyToken from '../middlewares/authMiddleware.js';

router.post('/', registrationController.createRegistration);
router.get('/event/:eventId', verifyToken, registrationController.getRegistrationsByEvent);
router.put('/:id', verifyToken, registrationController.updateRegistration);

export default router;
