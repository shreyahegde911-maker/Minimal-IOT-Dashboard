
const pool = require("../config/database");

// Validate incoming telemetry
function validateTelemetry(sensorId, temperature, humidity) {
    if (!sensorId || temperature === undefined || humidity === undefined) {
        return {
            valid: false,
            message: "sensorId, temperature and humidity are required"
        };
    }

    if (typeof sensorId !== "string" || sensorId.trim() === "") {
        return {
            valid: false,
            message: "sensorId must be a non-empty string"
        };
    }

    if (typeof temperature !== "number" || !Number.isFinite(temperature)) {
        return {
            valid: false,
            message: "temperature must be a number"
        };
    }

    if (temperature < -40 || temperature > 85) {
        return {
            valid: false,
            message: "temperature must be between -40 and 85"
        };
    }

    if (typeof humidity !== "number" || !Number.isFinite(humidity)) {
        return {
            valid: false,
            message: "humidity must be a number"
        };
    }

    if (humidity < 0 || humidity > 100) {
        return {
            valid: false,
            message: "humidity must be between 0 and 100"
        };
    }

    return { valid: true };
}

// Create a complete telemetry record
function createTelemetryRecord(sensorId, temperature, humidity) {
    return {
        sensorId: sensorId.trim(),
        temperature,
        humidity,
        timestamp: new Date().toISOString()
    };
}

// Convert a PostgreSQL row into the existing API format
function mapTelemetryRow(row) {
    return {
        sensorId: row.device_id,
        temperature: row.temperature,
        humidity: row.humidity,
        timestamp: new Date(row.time).toISOString()
    };
}

// Store telemetry in PostgreSQL
async function storeTelemetry(telemetry) {
    const query = `
        INSERT INTO telemetry_logs
            (time, device_id, temperature, humidity, status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING time, device_id, temperature, humidity, status
    `;

    const values = [
        telemetry.timestamp,
        telemetry.sensorId,
        telemetry.temperature,
        telemetry.humidity,
        "NORMAL"
    ];

    const result = await pool.query(query, values);
    return mapTelemetryRow(result.rows[0]);
}

// Retrieve all telemetry records
async function getAllTelemetry() {
    const result = await pool.query(`
        SELECT time, device_id, temperature, humidity, status
        FROM telemetry_logs
        ORDER BY time DESC
    `);

    return result.rows.map(mapTelemetryRow);
}

// Retrieve telemetry for a particular sensor
async function getTelemetryBySensor(sensorId) {
    const result = await pool.query(
        `SELECT time, device_id, temperature, humidity, status
         FROM telemetry_logs
         WHERE device_id = $1
         ORDER BY time DESC`,
        [sensorId]
    );

    return result.rows.map(mapTelemetryRow);
}

module.exports = {
    validateTelemetry,
    createTelemetryRecord,
    storeTelemetry,
    getAllTelemetry,
    getTelemetryBySensor
};
