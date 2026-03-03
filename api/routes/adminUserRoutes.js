const express = require('express');
const router = express.Router();
const { getAllUsers, getUserById } = require('../controller/adminUserController');

router.get('/user/admin', getAllUsers);
router.get('/user/admin/:id', getUserById);

module.exports = router;
