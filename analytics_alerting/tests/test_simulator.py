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


def test_simulator_freeze_anomaly():
    """Verify that freeze anomaly (-5.0°C) triggers on tick 50 for sensor-02."""
    sensor = SENSORS[1]  # sensor-02
    anomaly_payload = generate_telemetry(sensor, tick=50)
    assert anomaly_payload["temperature"] == -5.0


def test_simulator_humidity_drop_anomaly():
    """Verify that severe humidity drop (10.0%) triggers on tick 75 for sensor-03."""
    sensor = SENSORS[2]  # sensor-03
    anomaly_payload = generate_telemetry(sensor, tick=75)
    assert anomaly_payload["humidity"] == 10.0


def test_simulator_run_cycle_dry_run():
    """Verify that run_cycle executes across all configured sensors in dry_run mode."""
    from simulator.simulator import run_cycle
    payloads = run_cycle(tick=1, dry_run=True)
    assert len(payloads) == len(SENSORS)
    for p in payloads:
        assert "sensorId" in p
        assert "temperature" in p
        assert "humidity" in p


def test_validate_payload_valid():
    """Verify that well-formed telemetry passes pre-flight validation."""
    from simulator.simulator import validate_payload
    valid_payload = {"sensorId": "sensor-01", "temperature": 23.4, "humidity": 55.0}
    assert validate_payload(valid_payload) is True


def test_validate_payload_invalid_structure():
    """Verify that missing fields or incorrect types are rejected."""
    from simulator.simulator import validate_payload
    assert validate_payload({}) is False
    assert validate_payload("string") is False
    assert validate_payload({"sensorId": "", "temperature": 20.0, "humidity": 50.0}) is False
    assert validate_payload({"sensorId": "sensor-01", "temperature": "hot", "humidity": 50.0}) is False
    assert validate_payload({"sensorId": "sensor-01", "temperature": 20.0, "humidity": None}) is False


def test_validate_payload_out_of_bounds():
    """Verify that values outside physical sensor thresholds are rejected."""
    from simulator.simulator import validate_payload
    assert validate_payload({"sensorId": "sensor-01", "temperature": -100.0, "humidity": 50.0}) is False
    assert validate_payload({"sensorId": "sensor-01", "temperature": 150.0, "humidity": 50.0}) is False
    assert validate_payload({"sensorId": "sensor-01", "temperature": 25.0, "humidity": -1.0}) is False
    assert validate_payload({"sensorId": "sensor-01", "temperature": 25.0, "humidity": 105.0}) is False


def test_simulator_recovery_after_anomaly():
    """Verify that sensor readings immediately recover to normal baseline range on the subsequent tick."""
    # sensor-01 recovers after tick 25
    assert generate_telemetry(SENSORS[0], tick=25)["temperature"] == 42.5
    assert generate_telemetry(SENSORS[0], tick=26)["temperature"] < 35.0

    # sensor-02 recovers after tick 50
    assert generate_telemetry(SENSORS[1], tick=50)["temperature"] == -5.0
    assert generate_telemetry(SENSORS[1], tick=51)["temperature"] > 15.0

    # sensor-03 recovers after tick 75
    assert generate_telemetry(SENSORS[2], tick=75)["humidity"] == 10.0
    assert generate_telemetry(SENSORS[2], tick=76)["humidity"] > 40.0


def test_simulator_multi_device_distribution():
    """Verify that virtual sensors retain independent base temperature and humidity baselines."""
    p1 = generate_telemetry(SENSORS[0], tick=10)
    p2 = generate_telemetry(SENSORS[1], tick=10)
    p3 = generate_telemetry(SENSORS[2], tick=10)

    assert p1["sensorId"] == "sensor-01"
    assert p2["sensorId"] == "sensor-02"
    assert p3["sensorId"] == "sensor-03"

    # sensor-02 runs hotter than sensor-03 on the diurnal curve
    assert p2["temperature"] > p3["temperature"]


def test_simulator_network_transmission_success(monkeypatch):
    """Verify that run_cycle handles HTTP 201 response properly with Bearer token."""
    from unittest.mock import MagicMock
    import requests
    from simulator.simulator import run_cycle

    mock_resp = MagicMock()
    mock_resp.status_code = 201
    monkeypatch.setattr(requests, "post", lambda *args, **kwargs: mock_resp)

    payloads = run_cycle(tick=1, dry_run=False, max_retries=1)
    assert len(payloads) == 3


def test_simulator_network_transmission_retry_handling(monkeypatch):
    """Verify backoff retry logic when backend returns error or raises network exception."""
    import requests
    from simulator.simulator import run_cycle

    attempts = []

    def mock_post(*args, **kwargs):
        attempts.append(1)
        raise requests.exceptions.Timeout("Connection timed out")

    monkeypatch.setattr(requests, "post", mock_post)

    payloads = run_cycle(tick=1, dry_run=False, max_retries=2)
    assert len(payloads) == 3
    # 3 sensors * 2 attempts = 6 attempts
    assert len(attempts) == 6


def test_simulator_main_cli_execution(monkeypatch):
    """Verify that main() parses CLI arguments and completes after specified tick count."""
    import sys
    from simulator.simulator import main

    monkeypatch.setattr(sys, "argv", ["simulator.py", "--dry-run", "--ticks", "2", "--interval", "0"])
    main()


