import express from 'express';
const router = express.Router();
import * as eventController from '../controllers/eventController.js';
import verifyToken from '../middlewares/authMiddleware.js';

router.get('/public', eventController.getPublicEvents);
router.post('/', verifyToken, eventController.createEvent);
router.get('/', verifyToken, eventController.getEvents);
router.get('/:id/full', verifyToken, eventController.getEventFull);
router.get('/:id', eventController.getEventById);
router.put('/:id', verifyToken, eventController.updateEvent);
router.delete('/:id', verifyToken, eventController.deleteEvent);

export default router;
