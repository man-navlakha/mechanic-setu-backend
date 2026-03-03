const express = require('express');
const router = express.Router();
const { getAllServices, createService, getServiceById } = require('../controller/serviceController');

router.get('/services', getAllServices);
router.post('/services', createService);
router.get('/services/:id', getServiceById);

module.exports = router;
