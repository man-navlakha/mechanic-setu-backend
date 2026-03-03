const express = require('express');
const router = express.Router();
const healthController = require('../controller/healthController');

router.get('/', healthController.getHome);
router.get('/health', healthController.getHealth);
router.get('/api/schema', healthController.getSchema);

module.exports = router;