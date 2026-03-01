const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../helper/authMiddleware');
const mechanicProfileController = require('../controller/profile/mechanicProfileController');

const GET = (paths, ...handlers) => router.get(paths, ...handlers);

GET(
    ['/Profile/MechanicProfile/', '/Profile/MechanicProfile'],
    authenticateToken,
    mechanicProfileController.getMechanicProfile
);

module.exports = router;
