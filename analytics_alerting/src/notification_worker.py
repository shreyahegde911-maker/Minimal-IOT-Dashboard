import time
import logging
import requests
from typing import Dict, Any, Optional

from analytics_alerting.src.config import Config

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("NotificationWorker")


class NotificationWorker:
    """
    Multi-Channel Notification Dispatch Worker.
    Sends formatted anomaly alerts to Discord, Webhooks, Telegram, or Email
    with cooldown throttling to prevent spamming.
    """

    def __init__(self, cooldown_seconds: int = None):
        self.cooldown_seconds = cooldown_seconds or Config.ALERT_COOLDOWN_SECONDS
        self.last_alert_time: Dict[str, float] = {}

    def _is_throttled(self, sensor_id: str, metric: str) -> bool:
        key = f"{sensor_id}:{metric}"
        now = time.time()
        last_time = self.last_alert_time.get(key, 0)
        
        if now - last_time < self.cooldown_seconds:
            logger.info(f"Alert throttled for {key} (Cooldown: {self.cooldown_seconds}s)")
            return True
        
        self.last_alert_time[key] = now
        return False

    def dispatch_alert(self, alert_data: Dict[str, Any]) -> bool:
        """
        Dispatches an anomaly alert to configured channels if not throttled.
        """
        sensor_id = alert_data.get("sensor_id", "unknown")
        metric = alert_data.get("metric", "telemetry")
        
        if self._is_throttled(sensor_id, metric):
            return False

        logger.warning(f"🚨 ANOMALY ALERT TRIGGERED: {alert_data['reason']} | Value: {alert_data['value']}")

        success = True
        
        # 1. Dispatch to Discord Webhook if configured
        if Config.DISCORD_WEBHOOK_URL:
            success &= self._send_discord_webhook(alert_data)
            
        # 2. Dispatch to Generic Webhook / Slack if configured
        if Config.SLACK_WEBHOOK_URL:
            success &= self._send_slack_webhook(alert_data)

        return success

    def _send_discord_webhook(self, alert_data: Dict[str, Any]) -> bool:
        payload = {
            "username": "MinIOT Alert Bot",
            "avatar_url": "https://cdn-icons-png.flaticon.com/512/564/564619.png",
            "embeds": [{
                "title": "🚨 Sensor Anomaly Detected",
                "color": 15158332,  # Red
                "fields": [
                    {"name": "Device ID", "value": f"`{alert_data['sensor_id']}`", "inline": True},
                    {"name": "Metric", "value": alert_data['metric'].capitalize(), "inline": True},
                    {"name": "Value", "value": f"**{alert_data['value']}**", "inline": True},
                    {"name": "Z-Score", "value": str(alert_data.get('z_score', 'N/A')), "inline": True},
                    {"name": "Reason", "value": alert_data['reason'], "inline": False}
                ],
                "timestamp": alert_data.get("timestamp")
            }]
        }
        try:
            res = requests.post(Config.DISCORD_WEBHOOK_URL, json=payload, timeout=5)
            return res.status_code == 204
        except Exception as e:
            logger.error(f"Failed to dispatch Discord webhook: {e}")
            return False

    def _send_slack_webhook(self, alert_data: Dict[str, Any]) -> bool:
        payload = {
            "text": f"🚨 *Sensor Anomaly Alert* | Device: `{alert_data['sensor_id']}` | Metric: {alert_data['metric']} = *{alert_data['value']}* | Reason: {alert_data['reason']}"
        }
        try:
            res = requests.post(Config.SLACK_WEBHOOK_URL, json=payload, timeout=5)
            return res.status_code == 200
        except Exception as e:
            logger.error(f"Failed to dispatch Slack webhook: {e}")
            return False
