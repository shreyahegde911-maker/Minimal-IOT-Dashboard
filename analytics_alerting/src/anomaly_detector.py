import numpy as np
from collections import deque
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from sklearn.ensemble import IsolationForest

from analytics_alerting.src.config import Config


class ZScoreAnomalyDetector:
    """
    Statistical Anomaly Detector using Rolling Window Z-Score Analysis.
    Detects sudden spikes, drops, and sensor drift per device stream.
    """

    def __init__(self, window_size: int = None, threshold: float = None):
        self.window_size = window_size or Config.ROLLING_WINDOW_SIZE
        self.threshold = threshold or Config.Z_SCORE_THRESHOLD
        self.windows: Dict[str, Dict[str, deque]] = {}

    def _get_window(self, sensor_id: str, metric: str) -> deque:
        if sensor_id not in self.windows:
            self.windows[sensor_id] = {
                "temperature": deque(maxlen=self.window_size),
                "humidity": deque(maxlen=self.window_size)
            }
        return self.windows[sensor_id][metric]

    def evaluate_reading(self, sensor_id: str, metric: str, value: float) -> Dict[str, Any]:
        """
        Evaluates a single metric reading against rolling Z-score and threshold rules.
        """
        window = self._get_window(sensor_id, metric)
        
        result = {
            "sensor_id": sensor_id,
            "metric": metric,
            "value": value,
            "is_anomaly": False,
            "z_score": 0.0,
            "reason": None,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        # Check absolute threshold breaches
        if metric == "temperature":
            if value > Config.TEMP_HIGH_THRESHOLD:
                result["is_anomaly"] = True
                result["reason"] = f"Temperature exceeded high limit ({value}°C > {Config.TEMP_HIGH_THRESHOLD}°C)"
            elif value < Config.TEMP_LOW_THRESHOLD:
                result["is_anomaly"] = True
                result["reason"] = f"Temperature below low limit ({value}°C < {Config.TEMP_LOW_THRESHOLD}°C)"
        elif metric == "humidity":
            if value > Config.HUMIDITY_HIGH_THRESHOLD:
                result["is_anomaly"] = True
                result["reason"] = f"Humidity exceeded high limit ({value}% > {Config.HUMIDITY_HIGH_THRESHOLD}%)"
            elif value < Config.HUMIDITY_LOW_THRESHOLD:
                result["is_anomaly"] = True
                result["reason"] = f"Humidity below low limit ({value}% < {Config.HUMIDITY_LOW_THRESHOLD}%)"

        # Calculate rolling Z-Score if sufficient history exists (>= 5 readings)
        if len(window) >= 5:
            mean = float(np.mean(window))
            std = float(np.std(window))
            
            if std > 1e-6:
                z_score = (value - mean) / std
                result["z_score"] = round(float(z_score), 3)
                
                if abs(z_score) >= self.threshold and not result["is_anomaly"]:
                    result["is_anomaly"] = True
                    direction = "spike" if z_score > 0 else "drop"
                    result["reason"] = f"Statistical Z-Score {direction} detected (Z={result['z_score']})"
            elif abs(value - mean) > 1.0 and not result["is_anomaly"]:
                # Constant baseline with a sudden change
                result["is_anomaly"] = True
                result["z_score"] = 999.0 if value > mean else -999.0
                result["reason"] = f"Statistical Z-Score divergence from baseline ({mean:.1f} -> {value:.1f})"

        # Append current value to rolling window history
        window.append(value)
        return result


class IsolationForestDetector:
    """
    Unsupervised Machine Learning Anomaly Detector using Isolation Forest.
    Evaluates multi-feature telemetry vectors [temperature, humidity, delta_temp, delta_hum].
    """

    def __init__(self, contamination: float = None):
        self.contamination = contamination or Config.ISOLATION_FOREST_CONTAMINATION
        self.model = IsolationForest(
            contamination=self.contamination,
            random_state=42,
            n_estimators=100
        )
        self.is_fitted = False
        self.sensor_history: Dict[str, deque] = {}
        self.training_buffer: List[List[float]] = []

    def extract_features(self, sensor_id: str, temp: float, humidity: float) -> List[float]:
        """
        Extracts multivariate feature vector [temp, humidity, delta_temp, delta_hum].
        """
        if sensor_id not in self.sensor_history:
            self.sensor_history[sensor_id] = deque(maxlen=20)

        history = self.sensor_history[sensor_id]
        if len(history) > 0:
            prev_temp, prev_hum = history[-1]
            delta_temp = round(float(temp - prev_temp), 3)
            delta_hum = round(float(humidity - prev_hum), 3)
        else:
            delta_temp = 0.0
            delta_hum = 0.0

        history.append((temp, humidity))
        feature_vector = [float(temp), float(humidity), delta_temp, delta_hum]
        
        # Collect baseline observations for online auto-training
        if not self.is_fitted:
            self.training_buffer.append(feature_vector)
            if len(self.training_buffer) >= 15:
                self.train(np.array(self.training_buffer))

        return feature_vector

    def train(self, feature_matrix: np.ndarray) -> None:
        """Trains the Isolation Forest model on historical feature matrix."""
        if len(feature_matrix) >= 10:
            self.model.fit(feature_matrix)
            self.is_fitted = True

    def predict_anomaly(self, feature_vector: List[float]) -> Dict[str, Any]:
        """Predicts whether a feature vector is anomalous."""
        if not self.is_fitted:
            return {"is_anomaly": False, "score": 0.0, "reason": "ML Model warming up"}

        X = np.array([feature_vector])
        prediction = self.model.predict(X)[0]  # -1 for anomaly, 1 for normal
        score = float(self.model.score_samples(X)[0])

        is_anomaly = bool(prediction == -1)
        return {
            "is_anomaly": is_anomaly,
            "score": round(score, 4),
            "reason": "Multivariate Isolation Forest anomaly flagged" if is_anomaly else "Normal"
        }

    def evaluate_telemetry(self, sensor_id: str, temp: float, humidity: float) -> Dict[str, Any]:
        """
        Extracts rate-of-change features and evaluates multivariate anomaly.
        """
        features = self.extract_features(sensor_id, temp, humidity)
        pred = self.predict_anomaly(features)
        return {
            "sensor_id": sensor_id,
            "metric": "multivariate_ml",
            "value": f"T={temp}°C, H={humidity}%",
            "features": features,
            "is_anomaly": pred["is_anomaly"],
            "score": pred["score"],
            "reason": pred["reason"],
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
