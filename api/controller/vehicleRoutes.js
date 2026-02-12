const express = require('express');
const router = express.Router();
const vehicleController = require('../controller/vehicleController');

// POST /api/vehicle/rc-info
router.post('/rc-info', vehicleController.getVehicleRCInfo);

module.exports = router;