import pytest
import numpy as np
from analytics_alerting.src.anomaly_detector import ZScoreAnomalyDetector, IsolationForestDetector


def test_z_score_normal_readings():
    detector = ZScoreAnomalyDetector(threshold=3.0)
    sensor_id = "sensor-test-01"

    # Feed normal temperature readings around 22°C
    normal_temps = [21.5, 22.0, 22.1, 21.9, 22.2, 22.0, 21.8]
    for temp in normal_temps:
        res = detector.evaluate_reading(sensor_id, "temperature", temp)
        assert res["is_anomaly"] is False


def test_z_score_temperature_spike():
    detector = ZScoreAnomalyDetector(threshold=3.0)
    sensor_id = "sensor-test-02"

    # Stable history around 20°C
    for _ in range(10):
        detector.evaluate_reading(sensor_id, "temperature", 20.0)

    # Sudden high spike to 45°C
    spike_res = detector.evaluate_reading(sensor_id, "temperature", 45.0)
    assert spike_res["is_anomaly"] is True
    assert "Temperature exceeded high limit" in spike_res["reason"] or "Z-Score" in spike_res["reason"]


def test_z_score_statistical_anomaly():
    detector = ZScoreAnomalyDetector(threshold=3.0)
    sensor_id = "sensor-test-03"

    # Stable baseline around 25°C with tiny variance
    for _ in range(15):
        detector.evaluate_reading(sensor_id, "temperature", 25.0)

    # Moderate jump to 32°C (below absolute high threshold 35°C, but statistically anomalous)
    jump_res = detector.evaluate_reading(sensor_id, "temperature", 32.0)
    assert jump_res["is_anomaly"] is True
    assert "Z-Score" in jump_res["reason"]


def test_isolation_forest_detector():
    detector = IsolationForestDetector(contamination=0.1)
    
    # Generate synthetic normal training data: [temp, humidity]
    np.random.seed(42)
    normal_data = np.random.normal(loc=[22.0, 50.0], scale=[1.0, 3.0], size=(100, 2))
    detector.train(normal_data)

    # Test normal point
    normal_pred = detector.predict_anomaly([22.1, 51.0])
    assert normal_pred["is_anomaly"] is False

    # Test outlier point
    outlier_pred = detector.predict_anomaly([55.0, 5.0])
    assert outlier_pred["is_anomaly"] is True
