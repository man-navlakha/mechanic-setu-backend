const express = require('express');
const router = express.Router();
const vehicleController = require('../controller/vehicleController');
const { authenticateToken } = require('../helper/authMiddleware');

/**
 * POST /api/vehicle/rc-info
 * Get vehicle registration certificate information from RapidAPI and save to database
 * Body: { vehicle_number: string }
 */
router.post('/rc-info', authenticateToken, vehicleController.getVehicleRCInfo);

/**
 * GET /api/vehicle/saved
 * Get all saved vehicles from database
 * Query: ?limit=50&offset=0&search=search_term
 */
router.get('/saved', vehicleController.getSavedVehicles);

/**
 * GET /api/vehicle/my-vehicles
 * Get vehicles belonging to the current user
 */
router.get('/my-vehicles', authenticateToken, vehicleController.getMyVehicles);

/**
 * GET /api/vehicle/saved/:vehicleId
 * Get specific vehicle from database by vehicle ID
 */
router.get('/saved/:vehicleId', vehicleController.getSavedVehicleById);

/**
 * DELETE /api/vehicle/saved/:vehicleId
 * Delete specific vehicle from database
 */
router.delete('/saved/:vehicleId', vehicleController.deleteSavedVehicle);

module.exports = router;
