const express = require("express");

const router = express.Router();

const {
    receiveTelemetry,
    getTelemetry,
    getTelemetryForSensor
} = require("../controllers/telemetryController");

const { apiTokenAuth } = require("../middleware/apiTokenAuth");
const { authenticateJWT } = require("../middleware/jwtAuth");

// POST /api/telemetry — Requires API token (Sensor Ingestion)
router.post("/", apiTokenAuth, receiveTelemetry);

// GET /api/telemetry — Requires JWT (Telemetry Retrieval)
router.get("/", authenticateJWT, getTelemetry);

// GET /api/telemetry/:sensorId — Requires JWT (Sensor-Specific Retrieval)
router.get("/:sensorId", authenticateJWT, getTelemetryForSensor);

module.exports = router;
