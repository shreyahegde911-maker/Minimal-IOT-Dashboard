import time
import math
import random
import logging
import os
import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("TelemetrySimulator")

BACKEND_INGEST_URL = os.getenv("BACKEND_INGEST_URL", "http://localhost:3000/api/telemetry")
SIMULATION_INTERVAL_SEC = int(os.getenv("SIMULATION_INTERVAL_SEC", "3"))

SENSORS = [
    {"id": "sensor-01", "base_temp": 22.0, "base_hum": 55.0},
    {"id": "sensor-02", "base_temp": 28.0, "base_hum": 40.0},
    {"id": "sensor-03", "base_temp": 18.0, "base_hum": 65.0},
]


def generate_telemetry(sensor: dict, tick: int) -> dict:
    """Generates realistic diurnal temperature curves with natural noise and injected anomalies."""
    base_t = sensor["base_temp"]
    base_h = sensor["base_hum"]

    # Diurnal temperature sine wave component
    diurnal_temp = 4.0 * math.sin(tick * 0.1)
    noise_temp = random.uniform(-0.5, 0.5)
    temperature = round(base_t + diurnal_temp + noise_temp, 2)

    # Inverse humidity curve with noise
    diurnal_hum = -3.0 * math.sin(tick * 0.1)
    noise_hum = random.uniform(-1.0, 1.0)
    humidity = round(max(0.0, min(100.0, base_h + diurnal_hum + noise_hum)), 2)

    # Periodically inject anomalies every 25 ticks for testing analytics engine
    if tick > 0 and tick % 25 == 0 and sensor["id"] == "sensor-01":
        logger.warning(f"🔥 INJECTING TEST ANOMALY SPIKE into {sensor['id']}!")
        temperature = 42.5  # High temperature threshold breach & Z-Score spike!

    return {
        "sensorId": sensor["id"],
        "temperature": temperature,
        "humidity": humidity
    }


def main():
    logger.info(f"Starting Telemetry Simulator targeting {BACKEND_INGEST_URL}...")
    tick = 0

    while True:
        tick += 1
        for sensor in SENSORS:
            payload = generate_telemetry(sensor, tick)
            try:
                res = requests.post(BACKEND_INGEST_URL, json=payload, timeout=3)
                if res.status_code == 201:
                    logger.info(f"Published telemetry: {payload['sensorId']} -> Temp: {payload['temperature']}°C, Hum: {payload['humidity']}%")
                else:
                    logger.warning(f"Backend returned HTTP {res.status_code}: {res.text}")
            except Exception as e:
                logger.error(f"Failed to publish telemetry to backend: {e}")

        time.sleep(SIMULATION_INTERVAL_SEC)


if __name__ == "__main__":
    main()
