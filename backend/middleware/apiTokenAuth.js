const crypto = require("crypto");

/**
 * Sensor & API Token Authentication Middleware
 * Supports X-Sensor-API-Key header (SAD §5 STRIDE Spoofing mitigation)
 * and backward-compatible Authorization: Bearer <token>.
 */
const apiTokenAuth = (req, res, next) => {
    const expectedToken = process.env.API_TOKEN;

    // Fail securely if the server token is not configured
    if (!expectedToken) {
        return res.status(503).json({
            success: false,
            message: "API authentication is not configured."
        });
    }

    let providedToken = null;

    // 1. Check documented X-Sensor-API-Key header (SAD Section 5)
    const sensorApiKey = req.headers["x-sensor-api-key"];
    if (sensorApiKey !== undefined && sensorApiKey !== null) {
        if (typeof sensorApiKey === "string" && sensorApiKey.trim() !== "") {
            providedToken = sensorApiKey.trim();
        } else {
            return res.status(401).json({
                success: false,
                message: "Invalid or missing API token."
            });
        }
    }

    // 2. Fall back to Authorization: Bearer <token> for backward compatibility
    if (!providedToken) {
        const authHeader = req.headers.authorization;
        if (authHeader) {
            if (!authHeader.startsWith("Bearer ")) {
                return res.status(401).json({
                    success: false,
                    message: "Authentication required. Provide an API key via X-Sensor-API-Key header or Bearer token."
                });
            }
            providedToken = authHeader.slice(7).trim();
        }
    }

    // 3. Reject if neither was provided or if token is empty
    if (!providedToken) {
        return res.status(401).json({
            success: false,
            message: "Authentication required. Provide an API key via X-Sensor-API-Key header or Bearer token."
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
