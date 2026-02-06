const express = require('express');
const router = express.Router();
const {
    getNearbyMechanics,
    getAllMechanics,
    getMechanicById
} = require('../controllers/mechanic.controller');

/**
 * @route   GET /api/mechanics/nearby
 * @desc    Get nearby mechanics based on user location
 * @query   latitude, longitude, radius (km), limit, onlineOnly
 * @example /api/mechanics/nearby?latitude=23.0049&longitude=72.5487&radius=5
 */
router.get('/nearby', getNearbyMechanics);

/**
 * @route   GET /api/mechanics
 * @desc    Get all mechanics
 */
router.get('/', getAllMechanics);

/**
 * @route   GET /api/mechanics/:id
 * @desc    Get single mechanic by ID
 */
router.get('/:id', getMechanicById);

module.exports = router;
