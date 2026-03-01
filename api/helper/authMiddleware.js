const jwt = require('jsonwebtoken');

// This must match the key used in Django SimpleJWT for HS256 signing.
const SIGNING_KEY = process.env.SIGNING_KEY;


/**
 * Middleware to authenticate a user via JWT in the 'access' cookie.
 * This mirrors Django's CookieJWTAuthentication and is used by protected routes.
 */
const authenticateToken = (req, res, next) => {
    // 1. Ensure the server is configured with a secret key
    if (!SIGNING_KEY) {
        console.error("⚠️ SIGNING_KEY is missing in .env for token verification.");
        return res.status(503).json({
            success: false,
            error: 'Server configuration error.'
        });
    }

    // 2. Extract token from the 'access' cookie
    const token = req.cookies?.access;

    if (!token) {
        console.warn('[authMiddleware] No access cookie. headers.cookie=', req.headers.cookie);
        return res.status(401).json({
            success: false,
            error: "Authentication credentials were not provided."
        });
    }

    // 3. Verify the token
    try {
        // Verify using the same secret and algorithm (HS256) as Django
        const decoded = jwt.verify(token, SIGNING_KEY, { algorithms: ['HS256'] });

        // Attach user info to the request object. Django SimpleJWT puts the user ID in 'user_id'.
        // Other controllers expect `req.user` with id and email for downstream logic.
        req.user = { id: decoded.user_id, email: decoded.email };
        next();
    } catch (err) {
        // This will catch expired tokens, invalid signatures, etc.
        return res.status(401).json({
            success: false,
            error: "Invalid or expired token",
            detail: err.message
        });
    }
};

module.exports = { authenticateToken };

// Optional variant: attaches user when present, but never blocks the request
module.exports.authenticateOptional = (req, _res, next) => {
    if (!SIGNING_KEY) return next();
    const token = req.cookies?.access;
    if (!token) return next();
    try {
        const decoded = jwt.verify(token, SIGNING_KEY, { algorithms: ['HS256'] });
        req.user = { id: decoded.user_id, email: decoded.email };
    } catch (_err) {
        // ignore decode errors for optional auth
    }
    next();
};
