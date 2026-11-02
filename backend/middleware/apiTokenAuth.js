
const crypto = require("crypto");

const apiTokenAuth = (req, res, next) => {
    const expectedToken = process.env.API_TOKEN;

    // Fail securely if the server token is not configured
    if (!expectedToken) {
        return res.status(503).json({
            success: false,
            message: "API authentication is not configured."
        });
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Authentication required. Provide a Bearer token."
        });
    }

    const providedToken = authHeader.slice(7).trim();

    if (!providedToken) {
        return res.status(401).json({
            success: false,
            message: "Invalid or missing API token."
        });
    }

    const expectedBuffer = Buffer.from(expectedToken);
    const providedBuffer = Buffer.from(providedToken);

    const isValid =
        expectedBuffer.length === providedBuffer.length &&
        crypto.timingSafeEqual(expectedBuffer, providedBuffer);

    if (!isValid) {
        return res.status(401).json({
            success: false,
            message: "Invalid API token."
        });
    }

    next();
};

module.exports = { apiTokenAuth };
