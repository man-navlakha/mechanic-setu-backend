const express = require('express');
const router = express.Router();
const { getAllUsers, getUserById, createUser, updateUser, deleteUser } = require('../controller/adminUserController');

// GET — List all users
router.get('/user/admin', getAllUsers);

// GET — Get single user by ID
router.get('/user/admin/:id', getUserById);

// POST — Create a new user
router.post('/user/admin', createUser);

// PATCH — Update a user
router.patch('/user/admin/:id', updateUser);

// DELETE — Delete a user
router.delete('/user/admin/:id', deleteUser);

module.exports = router;
