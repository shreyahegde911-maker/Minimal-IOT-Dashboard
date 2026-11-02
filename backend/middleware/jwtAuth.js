const jwt = require("jsonwebtoken");

/**
 * Middleware to authenticate requests using JSON Web Tokens (JWT).
 * Enforces HS256 algorithm and verifies token validity and claims.
 *
 * Conforms to IOT-NFR-021 (JWT Authentication).
 */
function authenticateJWT(req, res, next) {
    if (!process.env.JWT_SECRET) {
        return res.status(503).json({
            success: false,
            message: "Authentication service is not configured"
        });
    }

    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            success: false,
            message: "Authorization header is required"
        });
    }

    const parts = authHeader.trim().split(/\s+/);
    if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) {
        return res.status(401).json({
            success: false,
            message: "Invalid authorization format. Format must be 'Bearer <token>'"
        });
    }

    const token = parts[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET, {
            algorithms: ["HS256"]
        });
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired access token"
        });
    }
}

module.exports = { authenticateJWT };
