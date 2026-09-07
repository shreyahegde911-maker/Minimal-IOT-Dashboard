
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


function receiveTelemetry(req, res) {

    const { sensorId, temperature, humidity } = req.body;

    // Validate incoming telemetry
    const validation = validateTelemetry(
        sensorId,
        temperature,
        humidity
    );

    // Reject invalid data
    if (!validation.valid) {
        return res.status(400).json({
            success: false,
            message: validation.message
        });
    }

    // Create telemetry record with timestamp
    const telemetry = createTelemetryRecord(
        sensorId,
        temperature,
        humidity
    );
    storeTelemetry(telemetry);

    // Log accepted telemetry
    console.log("Telemetry received:", telemetry);

    // Broadcast telemetry to connected clients
    broadcastTelemetry(telemetry);

    // Send successful response
    res.status(201).json({
        success: true,
        message: "Telemetry received successfully",
        data: telemetry
    });
}

function getTelemetry(req, res) {

    const telemetry = getAllTelemetry();

    res.status(200).json({
        success: true,
        count: telemetry.length,
        data: telemetry
    });
}

function getTelemetryForSensor(req, res) {

    const { sensorId } = req.params;

    const telemetry = getTelemetryBySensor(sensorId);

    res.status(200).json({
        success: true,
        sensorId: sensorId,
        count: telemetry.length,
        data: telemetry
    });
}


module.exports = {
    receiveTelemetry,
    getTelemetry,
    getTelemetryForSensor
};