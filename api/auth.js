const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const dotenv = require('dotenv');

// Load environment variables
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// --- CONFIGURATION MATCHING DJANGO SETTINGS ---
// 1. Use the single SIGNING_KEY (HS256) instead of Private/Public keys
const SIGNING_KEY = process.env.SIGNING_KEY;

// 2. Match Lifetimes from Django settings
const ACCESS_TOKEN_LIFETIME = '15m'; // timedelta(minutes=15)
const REFRESH_TOKEN_LIFETIME = '7d'; // timedelta(days=7)

router.post('/refresh', (req, res) => {
    // 1. Check for Signing Key
    if (!SIGNING_KEY) {
        console.error("⚠️ SIGNING_KEY is missing in .env");
        return res.status(503).json({
            success: false,
            error: 'Server configuration error.'
        });
    }

    // 2. Get Refresh Token from Cookie (preferred) or Body
    const rawRefreshToken = req.cookies?.refresh || req.body?.refresh;

    if (!rawRefreshToken) {
        return res.status(401).json({ success: false, error: 'Refresh token is required' });
    }

    // 3. Verify the existing Refresh Token
    // We use the same SIGNING_KEY for verification in HS256
    jwt.verify(rawRefreshToken, SIGNING_KEY, { algorithms: ['HS256'] }, (err, decodedPayload) => {
        if (err) {
            console.error("Token verification failed:", err.message);
            return res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
        }

        // 4. ROTATION LOGIC (Match Django's "ROTATE_REFRESH_TOKENS": True)

        // Extract strictly necessary user data. 
        // Django SimpleJWT puts the user ID in "user_id".
        const payload = {
            user_id: decodedPayload.user_id,
            // Add other claims here if your Django custom user model adds them
            // e.g., email: decodedPayload.email 
        };

        // A. Generate NEW Access Token
        const newAccessToken = jwt.sign(
            { ...payload, token_type: 'access' }, // Standard SimpleJWT claims
            SIGNING_KEY,
            { expiresIn: ACCESS_TOKEN_LIFETIME, algorithm: 'HS256' }
        );

        // B. Generate NEW Refresh Token (Rotation)
        const newRefreshToken = jwt.sign(
            { ...payload, token_type: 'refresh' }, // Standard SimpleJWT claims
            SIGNING_KEY,
            { expiresIn: REFRESH_TOKEN_LIFETIME, algorithm: 'HS256' }
        );

        // 5. Set Cookies (Matching Django's set_auth_cookies)
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // True in prod
            sameSite: 'None', // Matches your Django "samesite": "None"
            path: '/'
        };

        // Set Access Cookie (15 mins)
        res.cookie('access', newAccessToken, {
            ...cookieOptions,
            maxAge: 15 * 60 * 1000
        });

        // Set Refresh Cookie (7 days)
        res.cookie('refresh', newRefreshToken, {
            ...cookieOptions,
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        // 6. Respond
        res.json({
            success: true,
            message: "Tokens refreshed successfully",
            // Optional: return tokens in body if your frontend needs them immediately
            // access: newAccessToken,
            // refresh: newRefreshToken
        });
    });
});

module.exports = router;