import argparse
import json
import math
import random
import time
from datetime import datetime, timezone


def generate_reading(device_id, current_time, device_offset):
    """Generate realistic temperature and humidity readings."""

    hour = current_time.hour + current_time.minute / 60.0

    # Temperature follows a daily cycle:
    # cooler during night, warmer during afternoon.
    temperature = (
        25.0
        + 5.0 * math.sin((hour - 6.0) * 2.0 * math.pi / 24.0)
        + device_offset
        + random.gauss(0, 0.4)
    )

    # Humidity generally moves opposite to temperature.
    humidity = (
        65.0
        - 12.0 * math.sin((hour - 6.0) * 2.0 * math.pi / 24.0)
        + random.gauss(0, 1.2)
    )

    humidity = max(20.0, min(95.0, humidity))

    return {
        "time": current_time.isoformat(),
        "device_id": device_id,
        "temperature": round(temperature, 2),
        "humidity": round(humidity, 2),
        "status": "NORMAL",
    }


def main():
    parser = argparse.ArgumentParser(
        description="Multi-sensor telemetry simulator"
    )

    parser.add_argument(
        "--devices",
        type=int,
        default=3,
        help="Number of virtual devices",
    )

    parser.add_argument(
        "--interval",
        type=float,
        default=5.0,
        help="Seconds between readings",
    )

    args = parser.parse_args()

    if args.devices < 1:
        raise ValueError("Number of devices must be at least 1")

    if args.interval <= 0:
        raise ValueError("Sampling interval must be greater than 0")

    devices = [
        (f"device-{i:03d}", random.uniform(-1.5, 1.5))
        for i in range(1, args.devices + 1)
    ]

    print(
        f"Starting telemetry simulator: "
        f"{args.devices} devices, "
        f"{args.interval}s interval"
    )

    try:
        while True:
            current_time = datetime.now(timezone.utc)

            for device_id, device_offset in devices:
                reading = generate_reading(
                    device_id,
                    current_time,
                    device_offset,
                )

                print(json.dumps(reading), flush=True)

            time.sleep(args.interval)

    except KeyboardInterrupt:
        print("\nTelemetry simulator stopped.")


if __name__ == "__main__":
    main()
