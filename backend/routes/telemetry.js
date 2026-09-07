const express = require("express");

const router = express.Router();

const {
    receiveTelemetry,
    getTelemetry,
    getTelemetryForSensor
} = require("../controllers/telemetryController");

// POST /api/telemetry
router.post("/", receiveTelemetry);

// GET /api/telemetry
router.get("/", getTelemetry);

// GET /api/telemetry/:sensorId
router.get("/:sensorId", getTelemetryForSensor);

module.exports = router;