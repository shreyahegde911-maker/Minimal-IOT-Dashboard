
const {
    validateTelemetry,
    createTelemetryRecord,
    storeTelemetry,
    getAllTelemetry,
    getTelemetryBySensor
} = require("../services/ingestionService");

const {
    broadcastTelemetry
} = require("../websocket/socket");

// Receive and persist telemetry
async function receiveTelemetry(req, res) {
    const { sensorId, temperature, humidity } = req.body;

    const validation = validateTelemetry(
        sensorId,
        temperature,
        humidity
    );

    if (!validation.valid) {
        return res.status(400).json({
            success: false,
            message: validation.message
        });
    }

    const telemetry = createTelemetryRecord(
        sensorId,
        temperature,
        humidity
    );

    try {
        // Save to PostgreSQL before reporting success
        const savedTelemetry = await storeTelemetry(telemetry);

        console.log("Telemetry received:", savedTelemetry);

        // Broadcast only after successful database insertion
        broadcastTelemetry(savedTelemetry);

        return res.status(201).json({
            success: true,
            message: "Telemetry received successfully",
            data: savedTelemetry
        });
    } catch (error) {
        console.error("Failed to store telemetry:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to store telemetry"
        });
    }
}

// Retrieve all telemetry
async function getTelemetry(req, res) {
    try {
        const telemetry = await getAllTelemetry();

        return res.status(200).json({
            success: true,
            count: telemetry.length,
            data: telemetry
        });
    } catch (error) {
        console.error("Failed to retrieve telemetry:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve telemetry"
        });
    }
}

// Retrieve telemetry for one sensor
async function getTelemetryForSensor(req, res) {
    const { sensorId } = req.params;

    try {
        const telemetry = await getTelemetryBySensor(sensorId);

        return res.status(200).json({
            success: true,
            sensorId,
            count: telemetry.length,
            data: telemetry
        });
    } catch (error) {
        console.error("Failed to retrieve sensor telemetry:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve sensor telemetry"
        });
    }
}

module.exports = {
    receiveTelemetry,
    getTelemetry,
    getTelemetryForSensor
};
