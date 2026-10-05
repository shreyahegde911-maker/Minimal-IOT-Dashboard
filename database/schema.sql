CREATE TABLE telemetry_logs (
    time        TIMESTAMPTZ NOT NULL,
    device_id   VARCHAR(64) NOT NULL,
    temperature DOUBLE PRECISION NOT NULL,
    humidity    DOUBLE PRECISION NOT NULL,
    status      VARCHAR(20) DEFAULT 'NORMAL'
);

CREATE INDEX idx_telemetry_device_time
ON telemetry_logs (device_id, time DESC);

SELECT create_hypertable('telemetry_logs', by_range('time'));

CREATE MATERIALIZED VIEW telemetry_hourly_avg AS
SELECT
    time_bucket('1 hour', time) AS hour_bucket,
    device_id,
    AVG(temperature) AS avg_temp,
    AVG(humidity) AS avg_humidity,
    MIN(temperature) AS min_temp,
    MAX(temperature) AS max_temp
FROM telemetry_logs
GROUP BY hour_bucket, device_id;

CREATE MATERIALIZED VIEW telemetry_minute_avg AS
SELECT
    time_bucket('1 minute', time) AS minute_bucket,
    device_id,
    AVG(temperature) AS avg_temp,
    AVG(humidity) AS avg_humidity,
    MIN(temperature) AS min_temp,
    MAX(temperature) AS max_temp
FROM telemetry_logs
GROUP BY minute_bucket, device_id;

CREATE MATERIALIZED VIEW telemetry_daily_avg AS
SELECT
    time_bucket('1 day', time) AS day_bucket,
    device_id,
    AVG(temperature) AS avg_temp,
    AVG(humidity) AS avg_humidity,
    MIN(temperature) AS min_temp,
    MAX(temperature) AS max_temp
FROM telemetry_logs
GROUP BY day_bucket, device_id;

SELECT add_retention_policy(
    'telemetry_logs',
    INTERVAL '30 days'
);