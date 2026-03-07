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
 * POST /api/vehicle/manual-add
 * Manually add vehicle with all details (instead of fetching from API)
 * Body: { vehicle_number, license_plate, brand_name, brand_model, owner_name, fuel_type, class, ... }
 */
router.post('/manual-add', vehicleController.addVehicleManually);

/**
 * POST /api/vehicle/mymotor
 * Add vehicle from MyMotor API response
 * Body: { status, data: { key_information, vehicle_details, insurance_details, puc_details } }
 */
router.post('/mymotor', vehicleController.addVehicleFromMyMotor);

/**
 * GET /api/vehicle/generate-image
 * Generate vehicle image URL from model name
 * Query: ?model=Swift or ?brand_model=Maruti%20Swift
 * Curl: curl "http://localhost:3000/api/vehicle/generate-image?model=Swift"
 */
router.get('/generate-image', vehicleController.generateVehicleImage);

/**
 * GET /api/vehicle/saved
 * Get all saved vehicles from database
 * Query: ?limit=50&offset=0&search=search_term
 * Curl: curl -X GET "http://localhost:3000/api/vehicle/saved?limit=10&offset=0"
 */
router.get('/saved', vehicleController.getSavedVehicles);

/**
 * GET /api/vehicle/my-vehicles
 * Returns all vehicles saved by the currently authenticated user.
 * This is a protected route.
 */
router.get('/my-vehicles', authenticateToken, vehicleController.getUserVehicles);

/**
 * GET /api/vehicle/saved/:vehicleId
 * Get specific vehicle from database by vehicle ID
 */
router.get('/saved/:vehicleId', vehicleController.getMyVehicles);

/**
 * PATCH /api/vehicle/saved/:vehicleId
 * Update specific vehicle details in database
 */
router.patch('/saved/:vehicleId', vehicleController.updateSavedVehicle);

/**
 * DELETE /api/vehicle/saved/:vehicleId
 * Delete specific vehicle from database
 */
router.delete('/saved/:vehicleId', vehicleController.deleteSavedVehicle);

module.exports = router;
