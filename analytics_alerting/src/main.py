import time
import logging
import requests
import socketio

from analytics_alerting.src.config import Config
from analytics_alerting.src.anomaly_detector import ZScoreAnomalyDetector
from analytics_alerting.src.notification_worker import NotificationWorker

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("AnalyticsMain")

sio = socketio.Client()
zscore_detector = ZScoreAnomalyDetector()
notification_worker = NotificationWorker()


@sio.event
def connect():
    logger.info("Connected to Backend Socket.IO Stream!")


@sio.event
def disconnect():
    logger.warning("Disconnected from Backend Socket.IO Stream")


@sio.on("telemetry")
def on_telemetry(data):
    logger.info(f"Received Telemetry Stream: {data}")
    sensor_id = data.get("sensorId", "unknown")
    temp = data.get("temperature")
    humidity = data.get("humidity")

    if temp is not None:
        res_temp = zscore_detector.evaluate_reading(sensor_id, "temperature", temp)
        if res_temp["is_anomaly"]:
            notification_worker.dispatch_alert(res_temp)

    if humidity is not None:
        res_hum = zscore_detector.evaluate_reading(sensor_id, "humidity", humidity)
        if res_hum["is_anomaly"]:
            notification_worker.dispatch_alert(res_hum)


def main():
    logger.info("Starting Analytics & Anomaly Detection Service...")
    connected = False
    
    while not connected:
        try:
            logger.info(f"Connecting to Backend Socket.IO at {Config.BACKEND_URL}...")
            sio.connect(Config.BACKEND_URL)
            connected = True
            sio.wait()
        except Exception as e:
            logger.error(f"Backend connection failed ({e}). Retrying in 5s...")
            time.sleep(5)


if __name__ == "__main__":
    main()
