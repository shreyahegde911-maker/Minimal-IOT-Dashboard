const express = require("express");
const http = require("http");

const app = express();
const PORT = 3000;

// Create HTTP server
const server = http.createServer(app);

// Middleware
app.use(express.json());

// Import routes
const telemetryRoutes = require("./routes/telemetry");

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

// Health check endpoint for container diagnostics & uptime monitoring
app.get("/api/health", (req, res) => {
    res.status(200).json({
        status: "healthy",
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Telemetry API
app.use("/api/telemetry", telemetryRoutes);

// Start server
if (require.main === module) {
    server.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

module.exports = { app, server };