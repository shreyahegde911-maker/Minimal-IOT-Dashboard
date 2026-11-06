import logging
import pytest
from unittest.mock import MagicMock
from analytics_alerting.src.main import connect, disconnect, on_telemetry


def test_main_socketio_events(caplog):
    caplog.set_level(logging.INFO)
    connect()
    assert "Connected to Backend Socket.IO Stream" in caplog.text

    disconnect()
    assert "Disconnected from Backend Socket.IO Stream" in caplog.text


def test_main_on_telemetry_flow(monkeypatch):
    import analytics_alerting.src.main as main_mod

    mock_dispatch = MagicMock()
    monkeypatch.setattr(main_mod.notification_worker, "dispatch_alert", mock_dispatch)

    # Normal reading
    data = {"sensorId": "test-sensor-01", "temperature": 23.0, "humidity": 50.0}
    on_telemetry(data)

    # Anomaly reading
    data_anomaly = {"sensorId": "test-sensor-01", "temperature": 50.0, "humidity": 10.0}
    on_telemetry(data_anomaly)
    assert mock_dispatch.called
