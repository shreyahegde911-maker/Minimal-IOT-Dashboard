from datetime import datetime, timezone
from typing import Dict, Any

from analytics_alerting.src.config import Config
from analytics_alerting.src.anomaly_detector import ZScoreAnomalyDetector, IsolationForestDetector


class HealthDiagnosticRunner:
    """
    Diagnostic & Health Status Monitoring Service for Member 4.
    Evaluates system uptime, active sensor windows, ML model readiness, and notification channel health.
    """

    def __init__(self, zscore_detector: ZScoreAnomalyDetector, ml_detector: IsolationForestDetector):
        self.zscore_detector = zscore_detector
        self.ml_detector = ml_detector
        self.start_time = datetime.now(timezone.utc)

    def get_system_health(self) -> Dict[str, Any]:
        """Returns comprehensive diagnostic health metrics for the analytics service."""
        now = datetime.now(timezone.utc)
        uptime_seconds = int((now - self.start_time).total_seconds())

        sensor_window_counts = {}
        for sensor_id, metrics in self.zscore_detector.windows.items():
            sensor_window_counts[sensor_id] = {
                "temp_window_len": len(metrics.get("temperature", [])),
                "hum_window_len": len(metrics.get("humidity", []))
            }

        return {
            "status": "HEALTHY",
            "service": "miniot-analytics-alerting",
            "uptime_seconds": uptime_seconds,
            "timestamp": now.isoformat(),
            "config": {
                "backend_url": Config.BACKEND_URL,
                "z_score_threshold": Config.Z_SCORE_THRESHOLD,
                "temp_high_limit": Config.TEMP_HIGH_THRESHOLD,
                "cooldown_seconds": Config.ALERT_COOLDOWN_SECONDS
            },
            "analytics_engine": {
                "active_sensors_tracked": len(sensor_window_counts),
                "sensor_window_metrics": sensor_window_counts,
                "isolation_forest_trained": self.ml_detector.is_fitted
            },
            "channels": {
                "discord_configured": bool(Config.DISCORD_WEBHOOK_URL),
                "slack_configured": bool(Config.SLACK_WEBHOOK_URL)
            }
        }
