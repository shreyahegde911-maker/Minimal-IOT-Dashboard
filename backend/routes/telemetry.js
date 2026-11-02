
const express = require("express");

const router = express.Router();

const {
    receiveTelemetry,
    getTelemetry,
    getTelemetryForSensor
} = require("../controllers/telemetryController");

const { authenticateJWT } = require("../middleware/jwtAuth");

// POST /api/telemetry — Sensor ingestion remains public
router.post("/", receiveTelemetry);

// GET /api/telemetry — Requires JWT
router.get("/", authenticateJWT, getTelemetry);

// GET /api/telemetry/:sensorId — Requires JWT
router.get("/:sensorId", authenticateJWT, getTelemetryForSensor);

module.exports = router;
