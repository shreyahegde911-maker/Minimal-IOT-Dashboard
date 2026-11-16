import time
import logging
from typing import Dict, Any

from analytics_alerting.src.config import Config

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("NotificationWorker")


class NotificationWorker:
    """
    In-System Anomaly Alert Worker.
    Logs structured anomaly alerts with per-sensor cooldown throttling
    to prevent log/alert flooding.
    """

    def __init__(self, cooldown_seconds: int = None):
        self.cooldown_seconds = cooldown_seconds if cooldown_seconds is not None else Config.ALERT_COOLDOWN_SECONDS
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
        Records an anomaly alert if not currently within the cooldown window.
        """
        sensor_id = alert_data.get("sensor_id", "unknown")
        metric = alert_data.get("metric", "telemetry")

        if self._is_throttled(sensor_id, metric):
            return False

        logger.warning(
            f"🚨 ANOMALY ALERT TRIGGERED [{sensor_id} | {metric}]: "
            f"{alert_data.get('reason')} | Value: {alert_data.get('value')}"
        )
        return True
