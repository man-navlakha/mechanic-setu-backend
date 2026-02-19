const express = require('express');
const router = express.Router();
const authController = require('../controller/authController');
const vehicleController = require('../controller/vehicleController');
const { authenticateToken } = require('../helper/authMiddleware');
const { ensureCsrfToken } = require('../helper/csrfMiddleware');

// Allow multiple middleware/handlers per route (authenticateToken, csrf, controller, etc.)
const POST = (paths, ...handlers) => router.post(paths, ...handlers);
const GET = (paths, ...handlers) => router.get(paths, ...handlers);

POST(['/users/Login_SignUp/', '/users/Login_SignUp'], authController.loginSignUp);
POST(['/users/otp-verify/', '/users/otp-verify'], authController.verifyOtp);
POST(['/users/resend-otp/', '/users/resend-otp'], authController.resendOtp);
POST(['/users/google/', '/users/google'], authController.googleLogin);
POST(
  ['/users/SetUsersDetail/', '/users/SetUsersDetail'],
  authenticateToken,
  ensureCsrfToken,
  authController.setUsersDetail
);
GET(['/Profile/UserProfile/', '/Profile/UserProfile'], authenticateToken, authController.getUserProfile);
GET(['/Profile/UserHistory/', '/Profile/UserHistory'], authenticateToken, vehicleController.getUserVehicles);
POST(['/users/logout/', '/users/logout'], authenticateToken, ensureCsrfToken, authController.logout);
GET(['/core/me/', '/core/me'], authenticateToken, authController.me);
POST(['/core/me/', '/core/me'], authenticateToken, authController.me);
POST(['/core/token/refresh/', '/core/token/refresh'], authController.refreshTokens);

module.exports = router;
