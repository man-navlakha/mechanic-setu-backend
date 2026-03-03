const express = require('express');
const router = express.Router();
const { getAllServiceRequests, getServiceRequestById } = require('../controller/adminServiceRequestController');

router.get('/service-requests/admin', getAllServiceRequests);
router.get('/service-requests/admin/:id', getServiceRequestById);

module.exports = router;
