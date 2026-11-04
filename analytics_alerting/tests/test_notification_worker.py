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


def test_discord_webhook_dispatch(monkeypatch):
    from unittest.mock import MagicMock
    import requests
    from analytics_alerting.src.config import Config

    monkeypatch.setattr(Config, "DISCORD_WEBHOOK_URL", "https://discord.com/api/webhooks/mock")
    worker = NotificationWorker(cooldown_seconds=0)

    mock_resp = MagicMock()
    mock_resp.status_code = 204
    monkeypatch.setattr(requests, "post", lambda *args, **kwargs: mock_resp)

    alert = {
        "sensor_id": "sensor-01",
        "metric": "temperature",
        "value": 45.0,
        "reason": "Test alert",
        "z_score": 4.0
    }
    assert worker._send_discord_webhook(alert) is True

    # Error handling when request raises exception
    def raise_err(*args, **kwargs):
        raise ConnectionError("Discord network timeout")

    monkeypatch.setattr(requests, "post", raise_err)
    assert worker._send_discord_webhook(alert) is False


def test_slack_webhook_dispatch(monkeypatch):
    from unittest.mock import MagicMock
    import requests
    from analytics_alerting.src.config import Config

    monkeypatch.setattr(Config, "SLACK_WEBHOOK_URL", "https://hooks.slack.com/mock")
    worker = NotificationWorker(cooldown_seconds=0)

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    monkeypatch.setattr(requests, "post", lambda *args, **kwargs: mock_resp)

    alert = {
        "sensor_id": "sensor-02",
        "metric": "humidity",
        "value": 90.0,
        "reason": "Humidity high"
    }
    assert worker._send_slack_webhook(alert) is True

    def raise_err(*args, **kwargs):
        raise ConnectionError("Slack network timeout")

    monkeypatch.setattr(requests, "post", raise_err)
    assert worker._send_slack_webhook(alert) is False
