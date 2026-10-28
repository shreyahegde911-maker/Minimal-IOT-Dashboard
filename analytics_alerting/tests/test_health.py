import pytest
from analytics_alerting.src.anomaly_detector import ZScoreAnomalyDetector, IsolationForestDetector
from analytics_alerting.src.health import HealthDiagnosticRunner


def test_health_diagnostic_runner():
    zscore_det = ZScoreAnomalyDetector()
    ml_det = IsolationForestDetector()
    health_runner = HealthDiagnosticRunner(zscore_det, ml_det)

    # Seed baseline reading for sensor-health-01
    zscore_det.evaluate_reading("sensor-health-01", "temperature", 23.5)

    health = health_runner.get_system_health()

    assert health["status"] == "HEALTHY"
    assert health["service"] == "miniot-analytics-alerting"
    assert health["uptime_seconds"] >= 0
    assert "active_sensors_tracked" in health["analytics_engine"]
    assert health["analytics_engine"]["active_sensors_tracked"] == 1
    assert "sensor-health-01" in health["analytics_engine"]["sensor_window_metrics"]
    assert health["analytics_engine"]["isolation_forest_trained"] is False


def test_health_diagnostic_runner_config_keys():
    zscore_det = ZScoreAnomalyDetector()
    ml_det = IsolationForestDetector()
    health_runner = HealthDiagnosticRunner(zscore_det, ml_det)

    health = health_runner.get_system_health()

    assert "backend_url" in health["config"]
    assert "z_score_threshold" in health["config"]
    assert "discord_configured" in health["channels"]


def test_health_diagnostic_self_check():
    zscore_det = ZScoreAnomalyDetector()
    ml_det = IsolationForestDetector()
    health_runner = HealthDiagnosticRunner(zscore_det, ml_det)

    result = health_runner.run_self_check()
    assert result["healthy"] is True
    assert result["checks"]["service_online"] is True
    assert result["checks"]["zscore_configured"] is True
    assert result["checks"]["backend_url_set"] is True

