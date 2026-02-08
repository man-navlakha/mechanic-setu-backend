const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SIGNING_KEY = process.env.SIGNING_KEY;

/**
 * Middleware to verify JWT token from Authorization header or cookies
 */
const authenticateToken = (req, res, next) => {
    if (!SIGNING_KEY) {
        console.warn("⚠️  Authentication SIGNING_KEY not configured.");
        return res.status(503).json({
            success: false,
            error: 'Authentication service not configured.'
        });
    }

    // Try to get token from header or cookies
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.split(' ')[1]) || req.cookies?.access;

    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Access token is required. Please login.'
        });
    }

    jwt.verify(token, SIGNING_KEY, { algorithms: ['HS256'] }, (err, decoded) => {
        if (err) {
            console.error('JWT Verification Error:', err.message);
            return res.status(403).json({
                success: false,
                error: 'Invalid or expired access token'
            });
        }

        // Add user info to request
        // Django SimpleJWT uses 'user_id', we map it to req.user.id for consistency
        req.user = {
            ...decoded,
            id: decoded.user_id || decoded.id
        };
        next();
    });
};

module.exports = {
    authenticateToken
};
