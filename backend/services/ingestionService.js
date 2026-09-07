const telemetryStore = [];

function validateTelemetry(sensorId, temperature, humidity) {

    // Check required fields
    if (!sensorId || temperature === undefined || humidity === undefined) {
        return {
            valid: false,
            message: "sensorId, temperature and humidity are required"
        };
    }

    // Validate sensor ID
    if (typeof sensorId !== "string" || sensorId.trim() === "") {
        return {
            valid: false,
            message: "sensorId must be a non-empty string"
        };
    }

    // Validate temperature
    if (typeof temperature !== "number" || Number.isNaN(temperature)) {
        return {
            valid: false,
            message: "temperature must be a number"
        };
    }

    // Validate humidity
    if (typeof humidity !== "number" || Number.isNaN(humidity)) {
        return {
            valid: false,
            message: "humidity must be a number"
        };
    }

    // Validate humidity range
    if (humidity < 0 || humidity > 100) {
        return {
            valid: false,
            message: "humidity must be between 0 and 100"
        };
    }

    return {
        valid: true
    };
}


// Create a complete telemetry record
function createTelemetryRecord(sensorId, temperature, humidity) {

    return {
        sensorId: sensorId.trim(),
        temperature: temperature,
        humidity: humidity,
        timestamp: new Date().toISOString()
    };
}

function storeTelemetry(telemetry) {
    telemetryStore.push(telemetry);
    return telemetry;
}

function getAllTelemetry() {
    return telemetryStore;
}

function getTelemetryBySensor(sensorId) {
    return telemetryStore.filter(
        telemetry => telemetry.sensorId === sensorId
    );
}

module.exports = {
    validateTelemetry,
    createTelemetryRecord,
    storeTelemetry,
    getAllTelemetry,
    getTelemetryBySensor
};