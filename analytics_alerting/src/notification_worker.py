import time
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Dict, Any, Optional
import requests

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

        # 3. Dispatch to Telegram if configured
        if Config.TELEGRAM_BOT_TOKEN and Config.TELEGRAM_CHAT_ID:
            success &= self._send_telegram(alert_data)

        # 4. Dispatch to Email via SMTP if configured
        if Config.SMTP_HOST and Config.ALERT_EMAIL_TO:
            success &= self._send_email(alert_data)

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

    def _send_telegram(self, alert_data: Dict[str, Any]) -> bool:
        """
        Dispatches formatted Markdown alert to a configured Telegram chat or channel.
        """
        if not Config.TELEGRAM_BOT_TOKEN or not Config.TELEGRAM_CHAT_ID:
            logger.warning("Telegram dispatch skipped: missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID")
            return False

        url = f"https://api.telegram.org/bot{Config.TELEGRAM_BOT_TOKEN}/sendMessage"
        message_text = (
            f"🚨 *MinIOT Anomaly Alert*\n\n"
            f"• *Device*: `{alert_data['sensor_id']}`\n"
            f"• *Metric*: {alert_data['metric'].capitalize()}\n"
            f"• *Value*: *{alert_data['value']}*\n"
            f"• *Z-Score*: `{alert_data.get('z_score', 'N/A')}`\n"
            f"• *Reason*: {alert_data['reason']}\n"
            f"• *Time*: {alert_data.get('timestamp', 'N/A')}"
        )
        payload = {
            "chat_id": Config.TELEGRAM_CHAT_ID,
            "text": message_text,
            "parse_mode": "Markdown",
            "disable_web_page_preview": True,
        }
        try:
            res = requests.post(url, json=payload, timeout=5)
            if res.status_code == 200:
                logger.info(f"Telegram alert successfully dispatched for {alert_data['sensor_id']}")
                return True
            logger.warning(f"Telegram API responded with HTTP {res.status_code}: {res.text}")
            return False
        except Exception as e:
            logger.error(f"Failed to dispatch Telegram alert: {e}")
            return False

    def _send_email(self, alert_data: Dict[str, Any]) -> bool:
        """
        Dispatches multi-part HTML & text alert email to designated operator address via SMTP.
        """
        if not Config.SMTP_HOST or not Config.ALERT_EMAIL_TO:
            logger.warning("Email dispatch skipped: missing SMTP_HOST or ALERT_EMAIL_TO")
            return False

        subject = f"[MinIOT Alert] Anomaly Detected on {alert_data['sensor_id']} ({alert_data['metric']})"
        from_addr = Config.ALERT_EMAIL_FROM or "alerts@miniot.local"
        to_addr = Config.ALERT_EMAIL_TO

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = from_addr
        msg["To"] = to_addr

        text_content = (
            f"MinIOT Anomaly Alert\n\n"
            f"Sensor ID: {alert_data['sensor_id']}\n"
            f"Metric: {alert_data['metric']}\n"
            f"Value: {alert_data['value']}\n"
            f"Z-Score: {alert_data.get('z_score', 'N/A')}\n"
            f"Reason: {alert_data['reason']}\n"
            f"Timestamp: {alert_data.get('timestamp', 'N/A')}\n"
        )

        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; background-color: #f4f6f8; padding: 20px;">
          <div style="max-width: 600px; margin: auto; background: white; border-radius: 8px; padding: 24px; border-left: 6px solid #e53e3e; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #e53e3e; margin-top: 0;">🚨 Sensor Anomaly Detected</h2>
            <p>An out-of-specification or statistical anomaly has been flagged by the MinIOT Analytics Engine.</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
              <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Device ID</td><td style="padding: 8px; border-bottom: 1px solid #eee;"><code>{alert_data['sensor_id']}</code></td></tr>
              <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Metric</td><td style="padding: 8px; border-bottom: 1px solid #eee;">{alert_data['metric'].capitalize()}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Observed Value</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; color: #e53e3e;">{alert_data['value']}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Z-Score</td><td style="padding: 8px; border-bottom: 1px solid #eee;">{alert_data.get('z_score', 'N/A')}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Reason</td><td style="padding: 8px; border-bottom: 1px solid #eee;">{alert_data['reason']}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Timestamp</td><td style="padding: 8px;">{alert_data.get('timestamp', 'N/A')}</td></tr>
            </table>
            <p style="margin-top: 24px; font-size: 12px; color: #718096;">Automated notification from MinIOT Member 4 Analytics & Alerting Worker.</p>
          </div>
        </body>
        </html>
        """

        msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        try:
            server = smtplib.SMTP(Config.SMTP_HOST, Config.SMTP_PORT, timeout=10)
            if Config.SMTP_USE_TLS:
                server.starttls()
            if Config.SMTP_USER and Config.SMTP_PASSWORD:
                server.login(Config.SMTP_USER, Config.SMTP_PASSWORD)
            server.sendmail(from_addr, [to_addr], msg.as_string())
            server.quit()
            logger.info(f"Email alert successfully dispatched to {to_addr}")
            return True
        except Exception as e:
            logger.error(f"Failed to dispatch Email alert via SMTP: {e}")
            return False
