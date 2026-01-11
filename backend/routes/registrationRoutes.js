import express from 'express';
const router = express.Router();
import * as registrationController from '../controllers/registrationController.js';
import verifyToken from '../middlewares/authMiddleware.js';

router.post('/', registrationController.createRegistration);
router.get('/', registrationController.getAllRegistrations);
router.get('/:eventId', verifyToken, registrationController.getRegistrationsByEvent);
router.put('/:id', verifyToken, registrationController.updateRegistration);
router.post('/:id/refund', verifyToken, registrationController.refundRegistration);
router.post('/:id/refund-addon', verifyToken, registrationController.refundAddOn);

// Ticket Transfer Routes
router.post('/:id/transfer', verifyToken, registrationController.transferTicket);
router.post('/:id/transfer/undo', verifyToken, registrationController.undoTransfer);
router.post('/:id/transfer/finalize', registrationController.finalizeTransfer);
router.get('/:id/transfer/:transferId', verifyToken, registrationController.getTransferStatus);

// Debug endpoint
router.get('/debug/transfers', registrationController.debugTransfers);

export default router;
