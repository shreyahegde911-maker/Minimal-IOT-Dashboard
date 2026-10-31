import argparse
import logging
import math
import os
import random
import time
from typing import Dict, List, Optional
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

    # Multi-mode anomaly injection across virtual sensors for analytics validation:
    # 1. High temperature threshold breach & Z-score spike (sensor-01 every 25 ticks)
    if tick > 0 and tick % 25 == 0 and sensor["id"] == "sensor-01":
        logger.warning(f"🔥 INJECTING TEST ANOMALY SPIKE into {sensor['id']} (42.5°C)!")
        temperature = 42.5
    # 2. Freezing out-of-spec anomaly (sensor-02 every 50 ticks)
    elif tick > 0 and tick % 50 == 0 and sensor["id"] == "sensor-02":
        logger.warning(f"❄️ INJECTING FREEZE ANOMALY into {sensor['id']} (-5.0°C)!")
        temperature = -5.0
    # 3. Severe humidity depletion anomaly (sensor-03 every 75 ticks)
    elif tick > 0 and tick % 75 == 0 and sensor["id"] == "sensor-03":
        logger.warning(f"💧 INJECTING HUMIDITY DROP ANOMALY into {sensor['id']} (10.0%)!")
        humidity = 10.0

    return {
        "sensorId": sensor["id"],
        "temperature": temperature,
        "humidity": humidity
    }


def run_cycle(tick: int, ingest_url: str = BACKEND_INGEST_URL, dry_run: bool = False) -> List[Dict]:
    """Runs a single simulation tick across all virtual sensors."""
    emitted = []
    for sensor in SENSORS:
        payload = generate_telemetry(sensor, tick)
        emitted.append(payload)

        if dry_run:
            logger.info(f"[DRY-RUN] Tick {tick} | {payload['sensorId']} -> Temp: {payload['temperature']}°C, Hum: {payload['humidity']}%")
            continue

        try:
            res = requests.post(ingest_url, json=payload, timeout=3)
            if res.status_code == 201:
                logger.info(f"Published telemetry: {payload['sensorId']} -> Temp: {payload['temperature']}°C, Hum: {payload['humidity']}%")
            else:
                logger.warning(f"Backend returned HTTP {res.status_code}: {res.text}")
        except Exception as e:
            logger.error(f"Failed to publish telemetry to backend: {e}")

    return emitted


def main():
    parser = argparse.ArgumentParser(description="Minimal IoT Multi-Sensor Telemetry Simulator")
    parser.add_argument("--url", default=BACKEND_INGEST_URL, help="Target backend ingestion URL")
    parser.add_argument("--interval", type=int, default=SIMULATION_INTERVAL_SEC, help="Simulation interval (sec)")
    parser.add_argument("--ticks", type=int, default=None, help="Number of ticks to run (None=infinite)")
    parser.add_argument("--dry-run", action="store_true", help="Generate payloads without sending network requests")
    args = parser.parse_args()

    logger.info(f"Starting Telemetry Simulator targeting {args.url} (dry_run={args.dry_run}, interval={args.interval}s)...")
    tick = 0

    while True:
        tick += 1
        run_cycle(tick, ingest_url=args.url, dry_run=args.dry_run)

        if args.ticks is not None and tick >= args.ticks:
            logger.info(f"Simulation completed after {tick} ticks.")
            break

        time.sleep(args.interval)


if __name__ == "__main__":
    main()
