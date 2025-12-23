const express = require('express');
const router = express.Router();
const registrationController = require('../controllers/registrationController');
const verifyToken = require('../middlewares/authMiddleware');

router.post('/', registrationController.createRegistration);
router.get('/event/:eventId', verifyToken, registrationController.getRegistrationsByEvent);
router.put('/:id', verifyToken, registrationController.updateRegistration);

module.exports = router;
