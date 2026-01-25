import express from 'express';
import * as eventController from '../controllers/eventController.js';
import { verifyToken, requireOrganizer } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public routes
router.get('/browse', eventController.browseEvents);
router.get('/search', eventController.searchEvents);
router.get('/:id/public', eventController.getEventPublic);
router.get('/:eventId/registrations/:registrationId/tickets/:ticketId', eventController.getTicketByUniqueId);

// Protected routes
router.get('/', verifyToken, eventController.getEvents);
router.get('/:id', verifyToken, eventController.getEvent);
router.post('/', verifyToken, requireOrganizer, eventController.createEvent);
router.put('/:id', verifyToken, requireOrganizer, eventController.updateEvent);
router.delete('/:id', verifyToken, requireOrganizer, eventController.deleteEvent);

// NEW: Event stats for check-in
router.get('/:id/stats', verifyToken, eventController.getEventStats);

export default router;