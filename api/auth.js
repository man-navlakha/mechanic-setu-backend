const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const dotenv = require('dotenv');

// Load environment variables
const result = dotenv.config({ path: '../.env' });

if (result.error) {
    console.warn("⚠️  .env file not found. Ensure environment variables are set manually.");
}

// --- CRITICAL STEP: Decode Keys from Base64 to String ---
// 1. privateKey: Used to SIGN new Access Tokens (Write)
const PRIVATE_KEY = process.env.PRIVATE_SIGNING_KEY 
    ? Buffer.from(process.env.PRIVATE_SIGNING_KEY, 'base64').toString('utf-8')
    : null;

// 2. publicKey: Used to VERIFY existing Refresh Tokens (Read)
const PUBLIC_KEY = process.env.PUBLIC_SIGNING_KEY 
    ? Buffer.from(process.env.PUBLIC_SIGNING_KEY, 'base64').toString('utf-8')
    : null;

const ACCESS_EXPIRY = '30m'; 

router.post('/refresh', (req, res) => {
    if (!PRIVATE_KEY || !PUBLIC_KEY) {
        return res.status(503).json({ 
            success: false, 
            error: 'Authentication service not configured. Missing signing keys.' 
        });
    }
    
    const refreshToken = req.cookies?.refresh || req.body?.refresh;

    if (!refreshToken) {
        return res.status(401).json({ success: false, error: 'Refresh token is required' });
    }

    // We use the Public Key to prove the token came from someone holding the Private Key (Django)
    jwt.verify(refreshToken, PUBLIC_KEY, { algorithms: ['RS256'] }, (err, decodedUser) => {
        if (err) {
            return res.status(403).json({ success: false, error: 'Invalid or expired refresh token' });
        }

        // We must sign with the Private Key so that the Resource Server (Django/Node)
        // can verify this new token using the Public Key later.
        const newAccessToken = jwt.sign(
            { id: decodedUser.id, email: decodedUser.email }, 
            PRIVATE_KEY, 
            { 
                algorithm: 'RS256', // Must specify algorithm
                expiresIn: ACCESS_EXPIRY 
            }
        );

        res.cookie('access', newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'None',
            maxAge: 30 * 60 * 1000 
        });

        res.json({ 
            success: true, 
            accessToken: newAccessToken,
            message: "Access token refreshed successfully" 
        });
    });
});

module.exports = router;