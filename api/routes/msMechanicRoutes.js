const express = require('express');
const router = express.Router();
const msMechanicController = require('../controller/msMechanicController');

router.get('/nearby', msMechanicController.getNearbyMsMechanics);
router.get('/', msMechanicController.getAllMsMechanics);
router.post('/', msMechanicController.createMsMechanic);
router.get('/:id', msMechanicController.getMsMechanicById);
router.patch('/:id', msMechanicController.updateMsMechanic);
router.delete('/:id', msMechanicController.deleteMsMechanic);
router.put('/:id/location', msMechanicController.updateMsMechanicLocation);
router.put('/:id/status', msMechanicController.updateMsMechanicStatus);

module.exports = router;