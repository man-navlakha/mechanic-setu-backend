const express = require('express');
const router = express.Router();
const { getStats } = require('../controller/adminStatsController');

router.get('/admin/stats', getStats);

module.exports = router;
