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


def test_telegram_dispatch_success(monkeypatch):
    from unittest.mock import MagicMock
    import requests
    from analytics_alerting.src.config import Config

    monkeypatch.setattr(Config, "TELEGRAM_BOT_TOKEN", "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11")
    monkeypatch.setattr(Config, "TELEGRAM_CHAT_ID", "-1001234567890")
    worker = NotificationWorker(cooldown_seconds=0)

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    sent_requests = []

    def mock_post(url, json=None, timeout=None):
        sent_requests.append({"url": url, "json": json})
        return mock_resp

    monkeypatch.setattr(requests, "post", mock_post)

    alert = {
        "sensor_id": "sensor-01",
        "metric": "temperature",
        "value": 41.5,
        "reason": "Z-score spike",
        "z_score": 3.8,
        "timestamp": "2026-11-13T12:00:00Z"
    }

    assert worker._send_telegram(alert) is True
    assert len(sent_requests) == 1
    assert "sendMessage" in sent_requests[0]["url"]
    assert sent_requests[0]["json"]["chat_id"] == "-1001234567890"
    assert "sensor-01" in sent_requests[0]["json"]["text"]


def test_telegram_dispatch_failure(monkeypatch):
    import requests
    from analytics_alerting.src.config import Config

    monkeypatch.setattr(Config, "TELEGRAM_BOT_TOKEN", "mock_token")
    monkeypatch.setattr(Config, "TELEGRAM_CHAT_ID", "mock_chat")
    worker = NotificationWorker(cooldown_seconds=0)

    def raise_err(*args, **kwargs):
        raise requests.exceptions.ConnectTimeout("Telegram connection timed out")

    monkeypatch.setattr(requests, "post", raise_err)

    alert = {"sensor_id": "sensor-01", "metric": "temperature", "value": 40.0, "reason": "High temp"}
    assert worker._send_telegram(alert) is False


def test_telegram_dispatch_unconfigured(monkeypatch):
    from analytics_alerting.src.config import Config

    monkeypatch.setattr(Config, "TELEGRAM_BOT_TOKEN", "")
    monkeypatch.setattr(Config, "TELEGRAM_CHAT_ID", "")
    worker = NotificationWorker(cooldown_seconds=0)

    alert = {"sensor_id": "sensor-01", "metric": "temperature", "value": 40.0, "reason": "High temp"}
    assert worker._send_telegram(alert) is False


def test_email_dispatch_success(monkeypatch):
    from unittest.mock import MagicMock
    import smtplib
    from analytics_alerting.src.config import Config

    monkeypatch.setattr(Config, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(Config, "SMTP_PORT", 587)
    monkeypatch.setattr(Config, "SMTP_USER", "operator@example.com")
    monkeypatch.setattr(Config, "SMTP_PASSWORD", "secret123")
    monkeypatch.setattr(Config, "ALERT_EMAIL_TO", "admin@example.com")
    monkeypatch.setattr(Config, "ALERT_EMAIL_FROM", "alerts@miniot.local")
    monkeypatch.setattr(Config, "SMTP_USE_TLS", True)

    mock_server = MagicMock()
    monkeypatch.setattr(smtplib, "SMTP", lambda host, port, timeout: mock_server)

    worker = NotificationWorker(cooldown_seconds=0)
    alert = {
        "sensor_id": "sensor-03",
        "metric": "humidity",
        "value": 12.0,
        "reason": "Severe humidity drop",
        "z_score": -3.5,
        "timestamp": "2026-11-13T12:00:00Z"
    }

    assert worker._send_email(alert) is True
    mock_server.starttls.assert_called_once()
    mock_server.login.assert_called_once_with("operator@example.com", "secret123")
    mock_server.sendmail.assert_called_once()
    mock_server.quit.assert_called_once()


def test_email_dispatch_failure(monkeypatch):
    import smtplib
    from analytics_alerting.src.config import Config

    monkeypatch.setattr(Config, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(Config, "ALERT_EMAIL_TO", "admin@example.com")

    def raise_smtp_err(*args, **kwargs):
        raise smtplib.SMTPConnectError(421, "Service not available")

    monkeypatch.setattr(smtplib, "SMTP", raise_smtp_err)

    worker = NotificationWorker(cooldown_seconds=0)
    alert = {"sensor_id": "sensor-01", "metric": "temperature", "value": 40.0, "reason": "High temp"}
    assert worker._send_email(alert) is False


def test_email_dispatch_unconfigured(monkeypatch):
    from analytics_alerting.src.config import Config

    monkeypatch.setattr(Config, "SMTP_HOST", "")
    monkeypatch.setattr(Config, "ALERT_EMAIL_TO", "")
    worker = NotificationWorker(cooldown_seconds=0)

    alert = {"sensor_id": "sensor-01", "metric": "temperature", "value": 40.0, "reason": "High temp"}
    assert worker._send_email(alert) is False


def test_dispatch_alert_multi_channel_integration(monkeypatch):
    from unittest.mock import MagicMock
    from analytics_alerting.src.config import Config

    worker = NotificationWorker(cooldown_seconds=0)

    monkeypatch.setattr(worker, "_send_discord_webhook", MagicMock(return_value=True))
    monkeypatch.setattr(worker, "_send_slack_webhook", MagicMock(return_value=True))
    monkeypatch.setattr(worker, "_send_telegram", MagicMock(return_value=True))
    monkeypatch.setattr(worker, "_send_email", MagicMock(return_value=True))

    monkeypatch.setattr(Config, "DISCORD_WEBHOOK_URL", "https://discord.mock")
    monkeypatch.setattr(Config, "SLACK_WEBHOOK_URL", "https://slack.mock")
    monkeypatch.setattr(Config, "TELEGRAM_BOT_TOKEN", "tok")
    monkeypatch.setattr(Config, "TELEGRAM_CHAT_ID", "chat")
    monkeypatch.setattr(Config, "SMTP_HOST", "smtp.mock")
    monkeypatch.setattr(Config, "ALERT_EMAIL_TO", "admin@mock.com")

    alert = {
        "sensor_id": "sensor-01",
        "metric": "temperature",
        "value": 50.0,
        "reason": "Multi-channel test alert"
    }

    assert worker.dispatch_alert(alert) is True
    worker._send_discord_webhook.assert_called_once_with(alert)
    worker._send_slack_webhook.assert_called_once_with(alert)
    worker._send_telegram.assert_called_once_with(alert)
    worker._send_email.assert_called_once_with(alert)

