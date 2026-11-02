
-- =========================================================
-- Minimal IoT Dashboard: Telemetry Database Schema
-- Requires TimescaleDB
-- =========================================================

-- 1. Raw telemetry table
CREATE TABLE IF NOT EXISTS telemetry_logs (
    time        TIMESTAMPTZ NOT NULL,
    device_id   VARCHAR(64) NOT NULL,
    temperature DOUBLE PRECISION NOT NULL,
    humidity    DOUBLE PRECISION NOT NULL,
    status      VARCHAR(20) DEFAULT 'NORMAL'
);

-- 2. Index for device-specific time-series queries
CREATE INDEX IF NOT EXISTS idx_telemetry_device_time
ON telemetry_logs (device_id, time DESC);

-- 3. Convert the table into a TimescaleDB hypertable
SELECT create_hypertable(
    'telemetry_logs',
    by_range('time'),
    if_not_exists => TRUE
);

-- 4. Minute-level continuous aggregate
CREATE MATERIALIZED VIEW telemetry_minute_avg
WITH (timescaledb.continuous) AS
SELECT
    time_bucket(INTERVAL '1 minute', time) AS minute_bucket,
    device_id,
    AVG(temperature) AS avg_temp,
    AVG(humidity) AS avg_humidity,
    MIN(temperature) AS min_temp,
    MAX(temperature) AS max_temp
FROM telemetry_logs
GROUP BY minute_bucket, device_id
WITH NO DATA;

-- 5. Hourly continuous aggregate
CREATE MATERIALIZED VIEW telemetry_hourly_avg
WITH (timescaledb.continuous) AS
SELECT
    time_bucket(INTERVAL '1 hour', time) AS hour_bucket,
    device_id,
    AVG(temperature) AS avg_temp,
    AVG(humidity) AS avg_humidity,
    MIN(temperature) AS min_temp,
    MAX(temperature) AS max_temp
FROM telemetry_logs
GROUP BY hour_bucket, device_id
WITH NO DATA;

-- 6. Daily continuous aggregate
CREATE MATERIALIZED VIEW telemetry_daily_avg
WITH (timescaledb.continuous) AS
SELECT
    time_bucket(INTERVAL '1 day', time) AS day_bucket,
    device_id,
    AVG(temperature) AS avg_temp,
    AVG(humidity) AS avg_humidity,
    MIN(temperature) AS min_temp,
    MAX(temperature) AS max_temp
FROM telemetry_logs
GROUP BY day_bucket, device_id
WITH NO DATA;

-- 7. Automatic refresh policy: minute aggregate
SELECT add_continuous_aggregate_policy(
    'telemetry_minute_avg',
    start_offset => INTERVAL '7 days',
    end_offset => INTERVAL '1 minute',
    schedule_interval => INTERVAL '5 minutes'
);

-- 8. Automatic refresh policy: hourly aggregate
SELECT add_continuous_aggregate_policy(
    'telemetry_hourly_avg',
    start_offset => INTERVAL '30 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '5 minutes'
);

-- 9. Automatic refresh policy: daily aggregate
SELECT add_continuous_aggregate_policy(
    'telemetry_daily_avg',
    start_offset => INTERVAL '30 days',
    end_offset => INTERVAL '1 day',
    schedule_interval => INTERVAL '5 minutes'
);

-- 10. Retain raw telemetry for 30 days
SELECT add_retention_policy(
    'telemetry_logs',
    drop_after => INTERVAL '30 days'
);

-- =========================================================
-- Initial population of continuous aggregates
-- Run after schema creation if historical data already exists.
-- These ranges cover the previous 30 days.
-- =========================================================

CALL refresh_continuous_aggregate(
    'telemetry_minute_avg',
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '1 minute'
);

CALL refresh_continuous_aggregate(
    'telemetry_hourly_avg',
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '1 hour'
);

CALL refresh_continuous_aggregate(
    'telemetry_daily_avg',
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '1 day'
);