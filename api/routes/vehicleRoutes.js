const express = require('express');
const router = express.Router();
const vehicleController = require('../controller/vehicleController');
const { authenticateToken } = require('../helper/authMiddleware');

/**
 * POST /api/vehicle/rc-info
 * Get vehicle registration certificate information from RapidAPI and save to database
 * Body: { vehicle_number: string }
 * Curl: curl -X POST http://localhost:3000/api/vehicle/rc-info -H "Content-Type: application/json" -d '{"vehicle_number": "MH14GH8765"}'
 */
router.post('/rc-info', vehicleController.getVehicleRCInfo);

/**
 * GET /api/vehicle/saved
 * Get all saved vehicles from database
 * Query: ?limit=50&offset=0&search=search_term
 * Curl: curl -X GET "http://localhost:3000/api/vehicle/saved?limit=10&offset=0"
 */
router.get('/saved', vehicleController.getSavedVehicles);

/**
 * GET /api/vehicle/my-vehicles
 * Returns vehicle details for a saved vehicle_id (frontend will pass vehicle_id)
 * Query example: ?vehicle_id=MH14GH8765
 */
router.get('/my-vehicles', vehicleController.getMyVehicles);

/**
 * GET /api/vehicle/saved/:vehicleId
 * Get specific vehicle from database by vehicle ID
 */
router.get('/saved/:vehicleId', vehicleController.getMyVehicles);

/**
 * DELETE /api/vehicle/saved/:vehicleId
 * Delete specific vehicle from database
 */
router.delete('/saved/:vehicleId', vehicleController.deleteSavedVehicle);

module.exports = router;
