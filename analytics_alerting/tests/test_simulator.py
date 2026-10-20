import pytest
from simulator.simulator import generate_telemetry, SENSORS


def test_simulator_telemetry_payload_structure():
    """Verify that generated telemetry payloads contain required fields and valid types."""
    sensor = SENSORS[0]
    payload = generate_telemetry(sensor, tick=1)

    assert "sensorId" in payload
    assert "temperature" in payload
    assert "humidity" in payload
    assert payload["sensorId"] == sensor["id"]
    assert isinstance(payload["temperature"], float)
    assert isinstance(payload["humidity"], float)


def test_simulator_humidity_bounds():
    """Verify that humidity values strictly remain within 0% to 100% bounds."""
    sensor = SENSORS[0]
    for tick in range(1, 50):
        payload = generate_telemetry(sensor, tick=tick)
        assert 0.0 <= payload["humidity"] <= 100.0


def test_simulator_anomaly_injection():
    """Verify that anomaly injection triggers on tick multiples of 25 for sensor-01."""
    sensor = SENSORS[0]  # sensor-01
    
    # Tick 25 should trigger anomaly spike (42.5°C)
    anomaly_payload = generate_telemetry(sensor, tick=25)
    assert anomaly_payload["temperature"] == 42.5

    # Tick 26 should return to normal curve range
    normal_payload = generate_telemetry(sensor, tick=26)
    assert normal_payload["temperature"] < 35.0
