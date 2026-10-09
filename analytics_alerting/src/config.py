import os

class Config:
    """System configuration loader for Analytics & Alerting Worker."""
    
    # Backend Connection
    BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3000")
    
    # Anomaly Sensitivity Thresholds
    Z_SCORE_THRESHOLD = float(os.getenv("Z_SCORE_THRESHOLD", "3.0"))
    ROLLING_WINDOW_SIZE = int(os.getenv("ROLLING_WINDOW_SIZE", "60"))
    ISOLATION_FOREST_CONTAMINATION = float(os.getenv("ISOLATION_FOREST_CONTAMINATION", "0.05"))
    
    # Dynamic Temperature & Humidity Rule Limits
    TEMP_HIGH_THRESHOLD = float(os.getenv("TEMP_HIGH_THRESHOLD", "35.0"))
    TEMP_LOW_THRESHOLD = float(os.getenv("TEMP_LOW_THRESHOLD", "-10.0"))
    HUMIDITY_HIGH_THRESHOLD = float(os.getenv("HUMIDITY_HIGH_THRESHOLD", "85.0"))
    HUMIDITY_LOW_THRESHOLD = float(os.getenv("HUMIDITY_LOW_THRESHOLD", "15.0"))
    
    # Notification & Alert Throttling
    ALERT_COOLDOWN_SECONDS = int(os.getenv("ALERT_COOLDOWN_SECONDS", "60"))
    DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL", "")
    TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
    TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
    SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL", "")
