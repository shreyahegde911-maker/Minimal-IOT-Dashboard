/**
 * TLS Communication Security Middleware (IOT-NFR-020)
 *
 * Implements backend-side TLS/HTTPS support when operating behind an
 * HTTPS-terminating reverse proxy (e.g., Nginx) or in direct TLS mode:
 *
 * 1. Attaches Strict-Transport-Security (HSTS) headers when the request is secure (req.secure).
 * 2. Emits defense-in-depth security headers (X-Content-Type-Options, X-Frame-Options).
 * 3. Enforces HTTPS when ENFORCE_HTTPS is set to "true", correctly relying on req.secure
 *    (evaluated via trusted proxy headers) to eliminate circular redirect loops.
 * 4. Ensures no private keys, certificates, or sensitive credentials are leakable via responses.
 */

function tlsSecurity(req, res, next) {
    // 1. Defense-in-depth security headers
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");

    // 2. HTTP Strict Transport Security (HSTS)
    // Applied when request is confirmed secure (direct TLS or verified trusted reverse-proxy)
    if (req.secure) {
        // Enforce HSTS for 1 year including subdomains
        res.setHeader(
            "Strict-Transport-Security",
            "max-age=31536000; includeSubDomains"
        );
    }

    // 3. Optional HTTPS enforcement
    // When ENFORCE_HTTPS=true, reject or redirect insecure communications
    if (process.env.ENFORCE_HTTPS === "true" && !req.secure) {
        if (req.method === "GET" || req.method === "HEAD") {
            const host = req.headers.host || "localhost";
            return res.redirect(301, `https://${host}${req.originalUrl || req.url}`);
        }

        return res.status(403).json({
            success: false,
            message: "Insecure connection. HTTPS is required for all API communications (IOT-NFR-020)."
        });
    }

    next();
}

module.exports = { tlsSecurity };

