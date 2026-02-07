const express = require('express');
const router = express.Router();
const healthController = require('../controllers/healthController');

router.get('/', healthController.getHome);
router.get('/health', healthController.getHealth);

module.exports = router;