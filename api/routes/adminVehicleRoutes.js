const express = require('express');
const router = express.Router();
const { getAllVehicles, getVehicleById, updateVehicle, deleteVehicle } = require('../controller/adminVehicleController');

router.get('/vehicle/admin', getAllVehicles);
router.get('/vehicle/admin/:vehicleId', getVehicleById);
router.patch('/vehicle/admin/:vehicleId', updateVehicle);
router.delete('/vehicle/admin/:vehicleId', deleteVehicle);

module.exports = router;
