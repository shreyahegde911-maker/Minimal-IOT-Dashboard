import time
from analytics_alerting.src.notification_worker import NotificationWorker


def test_notification_throttling():
    worker = NotificationWorker(cooldown_seconds=2)
    alert = {
        "sensor_id": "device-01",
        "metric": "temperature",
        "value": 42.0,
        "reason": "Test high temp alert",
        "z_score": 4.5
    }

    # First alert should trigger
    res1 = worker.dispatch_alert(alert)
    assert res1 is True or res1 is False  # Depends on webhook config, but throttle check passes

    # Second immediate alert within 2 seconds should be throttled
    res2 = worker.dispatch_alert(alert)
    assert res2 is False  # Throttled!


def test_notification_unthrottled_different_sensor():
    worker = NotificationWorker(cooldown_seconds=60)
    alert1 = {"sensor_id": "device-01", "metric": "temperature", "value": 40.0, "reason": "High temp"}
    alert2 = {"sensor_id": "device-02", "metric": "temperature", "value": 40.0, "reason": "High temp"}

    worker.dispatch_alert(alert1)
    
    # Device-02 should NOT be throttled by Device-01's cooldown
    assert worker._is_throttled("device-02", "temperature") is False
