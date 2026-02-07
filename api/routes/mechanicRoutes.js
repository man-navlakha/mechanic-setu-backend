const express = require('express');
const router = express.Router();
const mechanicController = require('../controllers/mechanicController');

router.get('/nearby', mechanicController.getNearbyMechanics);
router.get('/', mechanicController.getAllMechanics);
router.get('/:id', mechanicController.getMechanicById);

module.exports = router;