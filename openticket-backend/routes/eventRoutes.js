const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const verifyToken = require('../middlewares/authMiddleware');

router.get('/public', eventController.getPublicEvents);
router.post('/', verifyToken, eventController.createEvent);
router.get('/', verifyToken, eventController.getEvents);
router.get('/:id', eventController.getEventById);
router.put('/:id', verifyToken, eventController.updateEvent);
router.delete('/:id', verifyToken, eventController.deleteEvent);

module.exports = router;
