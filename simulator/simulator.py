import argparse
import logging
import math
import os
import random
import time
from typing import Dict, List

import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)

logger = logging.getLogger("TelemetrySimulator")

BACKEND_INGEST_URL = os.getenv(
    "BACKEND_INGEST_URL",
    "http://localhost:3000/api/telemetry",
)

SIMULATION_INTERVAL_SEC = int(
    os.getenv("SIMULATION_INTERVAL_SEC", "3")
)

API_TOKEN = os.getenv("API_TOKEN", "")

SENSORS = [
    {"id": "sensor-01", "base_temp": 22.0, "base_hum": 55.0},
    {"id": "sensor-02", "base_temp": 28.0, "base_hum": 40.0},
    {"id": "sensor-03", "base_temp": 18.0, "base_hum": 65.0},
]


def generate_telemetry(sensor: dict, tick: int) -> dict:
    """Generate realistic readings and inject test anomalies."""
    base_t = sensor["base_temp"]
    base_h = sensor["base_hum"]

    diurnal_temp = 4.0 * math.sin(tick * 0.1)
    noise_temp = random.uniform(-0.5, 0.5)
    temperature = round(base_t + diurnal_temp + noise_temp, 2)

    diurnal_hum = -3.0 * math.sin(tick * 0.1)
    noise_hum = random.uniform(-1.0, 1.0)

    humidity = round(
        max(0.0, min(100.0, base_h + diurnal_hum + noise_hum)),
        2,
    )

    if tick > 0 and tick % 25 == 0 and sensor["id"] == "sensor-01":
        logger.warning(
            "Injecting high-temperature anomaly into %s (42.5 C)",
            sensor["id"],
        )
        temperature = 42.5

    elif tick > 0 and tick % 50 == 0 and sensor["id"] == "sensor-02":
        logger.warning(
            "Injecting freezing anomaly into %s (-5.0 C)",
            sensor["id"],
        )
        temperature = -5.0

    elif tick > 0 and tick % 75 == 0 and sensor["id"] == "sensor-03":
        logger.warning(
            "Injecting humidity-drop anomaly into %s (10.0%%)",
            sensor["id"],
        )
        humidity = 10.0

    return {
        "sensorId": sensor["id"],
        "temperature": temperature,
        "humidity": humidity,
    }


def validate_payload(payload: dict) -> bool:
    """Validate payload fields and allowed boundaries."""
    if not isinstance(payload, dict):
        return False

    sensor_id = payload.get("sensorId")

    if not isinstance(sensor_id, str) or not sensor_id.strip():
        return False

    temp = payload.get("temperature")

    if (
        temp is None
        or not isinstance(temp, (int, float))
        or not math.isfinite(temp)
        or not (-50.0 <= temp <= 100.0)
    ):
        return False

    hum = payload.get("humidity")

    if (
        hum is None
        or not isinstance(hum, (int, float))
        or not math.isfinite(hum)
        or not (0.0 <= hum <= 100.0)
    ):
        return False

    return True


def run_cycle(
    tick: int,
    ingest_url: str = BACKEND_INGEST_URL,
    dry_run: bool = False,
    max_retries: int = 2,
) -> List[Dict]:
    """Generate readings, validate them, and publish with retries."""

    emitted = []

    headers = {}

    if API_TOKEN:
        headers["Authorization"] = f"Bearer {API_TOKEN}"

    for sensor in SENSORS:
        payload = generate_telemetry(sensor, tick)

        if not validate_payload(payload):
            logger.error(
                "Generated invalid payload for %s: %s",
                sensor["id"],
                payload,
            )
            continue

        emitted.append(payload)

        if dry_run:
            logger.info(
                "[DRY-RUN] Tick %s | %s -> Temp: %s C, Humidity: %s%%",
                tick,
                payload["sensorId"],
                payload["temperature"],
                payload["humidity"],
            )
            continue

        if not API_TOKEN:
            logger.error(
                "API_TOKEN is missing. Cannot publish telemetry."
            )
            break

        success = False

        for attempt in range(max_retries):
            try:
                response = requests.post(
                    ingest_url,
                    json=payload,
                    headers=headers,
                    timeout=3,
                )

                if response.status_code == 201:
                    logger.info(
                        "Published telemetry: %s -> Temp: %s C, Humidity: %s%%",
                        payload["sensorId"],
                        payload["temperature"],
                        payload["humidity"],
                    )
                    success = True
                    break

                logger.warning(
                    "Backend returned HTTP %s on attempt %s: %s",
                    response.status_code,
                    attempt + 1,
                    response.text,
                )

            except requests.RequestException as exc:
                logger.warning(
                    "Attempt %s failed for %s: %s",
                    attempt + 1,
                    payload["sensorId"],
                    exc,
                )

            if attempt < max_retries - 1:
                time.sleep(0.5)

        if not success:
            logger.error(
                "Failed to publish telemetry for %s after %s attempts.",
                payload["sensorId"],
                max_retries,
            )

    return emitted


def main():
    parser = argparse.ArgumentParser(
        description="Minimal IoT Multi-Sensor Telemetry Simulator"
    )

    parser.add_argument(
        "--url",
        default=BACKEND_INGEST_URL,
        help="Target backend ingestion URL",
    )

    parser.add_argument(
        "--interval",
        type=int,
        default=SIMULATION_INTERVAL_SEC,
        help="Simulation interval in seconds",
    )

    parser.add_argument(
        "--ticks",
        type=int,
        default=None,
        help="Number of simulation ticks (default: run indefinitely)",
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Generate payloads without sending network requests",
    )

    args = parser.parse_args()

    if args.interval < 0:
        parser.error("--interval must be non-negative")

    if args.ticks is not None and args.ticks < 0:
        parser.error("--ticks must be non-negative")

    if not args.dry_run and not API_TOKEN:
        parser.error(
            "API_TOKEN is missing. Set it in your environment or .env file."
        )

    logger.info(
        "Starting Telemetry Simulator targeting %s "
        "(dry_run=%s, interval=%ss)...",
        args.url,
        args.dry_run,
        args.interval,
    )

    tick = 0

    while True:
        tick += 1

        run_cycle(
            tick,
            ingest_url=args.url,
            dry_run=args.dry_run,
        )

        if args.ticks is not None and tick >= args.ticks:
            logger.info("Simulation completed after %s ticks.", tick)
            break

        time.sleep(args.interval)


if __name__ == "__main__":
    main()