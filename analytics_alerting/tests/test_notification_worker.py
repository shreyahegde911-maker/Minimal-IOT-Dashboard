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
    assert worker.dispatch_alert(alert) is True

    # Second immediate alert within 2 seconds should be throttled
    assert worker.dispatch_alert(alert) is False


def test_notification_unthrottled_different_sensor():
    worker = NotificationWorker(cooldown_seconds=60)
    alert1 = {"sensor_id": "device-01", "metric": "temperature", "value": 40.0, "reason": "High temp"}
    alert2 = {"sensor_id": "device-02", "metric": "temperature", "value": 40.0, "reason": "High temp"}

    assert worker.dispatch_alert(alert1) is True
    # Device-02 should NOT be throttled by Device-01's cooldown
    assert worker.dispatch_alert(alert2) is True
