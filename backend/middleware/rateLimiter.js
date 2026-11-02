
const rateLimit = require("express-rate-limit");

// Rate limiter for API requests
const apiLimiter = rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,

    // Maximum requests allowed per client within the window
    limit: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,

    standardHeaders: true,
    legacyHeaders: false,

    message: {
        success: false,
        message: "Too many requests. Please try again later."
    }
});

module.exports = { apiLimiter };
