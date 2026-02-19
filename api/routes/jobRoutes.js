const express = require('express');
const router = express.Router();
const { createServiceRequest } = require('../controller/jobController');
const { authenticateOptional } = require('../helper/authMiddleware');

// Accept both authenticated and guest submissions; auth is optional
router.post('/jobs/CreateServiceRequest', authenticateOptional, createServiceRequest);

module.exports = router;
