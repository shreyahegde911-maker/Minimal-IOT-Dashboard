require("dotenv").config({
    path: require("path").resolve(__dirname, "../.env"),
    quiet: true
});

const express = require("express");
const http = require("http");

const app = express();
const PORT = process.env.PORT || 3000;
// Configure proxy trust for reverse proxy topologies (Nginx / Docker)
// Defaults to loopback and private container subnets (RFC 1918 / unique local).
// Avoids 'true' which blindly trusts untrusted headers and allows IP/proto spoofing.
const TRUST_PROXY = process.env.TRUST_PROXY || "loopback, linklocal, uniquelocal";
app.set("trust proxy", TRUST_PROXY);

// Create HTTP server
const server = http.createServer(app);

// Import TLS & Security middleware (IOT-NFR-020)
const { tlsSecurity } = require("./middleware/tlsSecurity");

// Global Middleware
app.use(tlsSecurity);
app.use(express.json());

// Serve dashboard frontend
const path = require("path");
app.use(express.static(path.join(__dirname, "../frontend")));

// Import routes
const telemetryRoutes = require("./routes/telemetry");
const rulesRoutes = require("./routes/rules");
const { apiLimiter } = require("./middleware/rateLimiter");

// Import WebSocket
const { initializeSocket } = require("./websocket/socket");

// Initialize Socket.IO
initializeSocket(server);

// Basic test route
app.get("/", (req, res) => {
    res.json({
        message: "Minimal IoT Dashboard Backend is running!"
    });
});

// Health check endpoint for container diagnostics, uptime, and TLS status
app.get("/api/health", (req, res) => {
    res.status(200).json({
        status: "healthy",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        security: {
            protocol: req.protocol,
            secure: req.secure,
            tls: req.secure ? "TLS 1.2+ active" : "Insecure (HTTP)"
        }
    });
});

// Telemetry API with rate limiting
app.use("/api/telemetry", apiLimiter, telemetryRoutes);

// Dynamic Rules Engine & Alert Management API with rate limiting (SAD §4.2, IOT-NFR-021)
app.use("/api/rules", apiLimiter, rulesRoutes);

// Start server
if (require.main === module) {
    server.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

module.exports = { app, server };
