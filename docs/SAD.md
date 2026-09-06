# Software Architecture & Design Specification (SAD)
## Minimal IoT Temperature & Humidity Monitoring Dashboard

**Project Name:** Minimal IoT Dashboard  
**Version:** 1.0  
**Date:** September 2026  
**Repository:** [Minimal-IOT-Dashboard](https://github.com/shreyahegde911-maker/Minimal-IOT-Dashboard)  
**Authors:** IoT Engineering Project Team  

---

## 1. Executive Summary & Architecture Goals

### 1.1 Purpose
This Software Architecture & Design (SAD) specification describes the high-level system architecture, service decomposition, technology stack, database design, API interfaces, and security threat model for the **Minimal IoT Dashboard**.

### 1.2 Core Architectural Principles
- **Decoupled Microservice Architecture:** Clear separation between data simulation, ingestion, storage, analytics/alerting, and web visualization.
- **Event-Driven & Low-Latency Streaming:** Real-time push model via WebSockets/SSE to deliver sub-200ms telemetry updates to the dashboard UI.
- **High-Performance Time-Series Persistence:** Specialized time-series schema with continuous rollups (1-min, 1-hr, 1-day) to maintain fast historical queries.
- **Resilient Containerization:** Dockerized container services connected via an isolated container bridge network with automated health monitoring and restart policies.

---

## 2. Technology Stack & Component Breakdown

| Layer / Component | Technology | Primary Owner | Responsibilities |
| :--- | :--- | :--- | :--- |
| **Frontend UI** | HTML5, CSS3, JavaScript, Chart.js / ECharts | Member 1 | Live interactive charts, device status cards, historical log export (CSV/JSON), WebSocket auto-reconnect client |
| **Backend & Ingestion** | Node.js (Express / Fastify) or Python (FastAPI) | Member 2 | Telemetry ingestion REST API, WebSocket/SSE server, dynamic threshold rule engine, JWT authentication |
| **Database & Storage** | TimescaleDB / PostgreSQL 15+ / MongoDB | Member 3 | Time-series schema, continuous aggregation views, automated retention downsampling |
| **Simulator** | Python 3.10+ (NumPy / SciPy) | Member 3 | Diurnal temperature generator, humidity noise injection, multi-device telemetry stream |
| **Analytics Engine** | Python 3.10+ (scikit-learn, Pandas) | Member 4 | Z-Score rolling stats, Isolation Forest anomaly scoring, drift detection |
| **Alert Worker** | Python 3.10+ (Requests, aiohttp) | Member 4 | Multi-channel dispatching (Webhooks, Discord/Telegram, Email), alert throttling |
| **DevOps & Orchestration** | Docker, Docker Compose, Nginx, GitHub Actions | Member 4 | Multi-container setup, reverse proxy, CI/CD pipeline, environment templates |

---

## 3. System Architecture & Component Diagram

```
+-----------------------------------------------------------------------------------+
|                                  DOCKER COMPOSE                                   |
|                                                                                   |
|  +------------------------+             +--------------------------------------+  |
|  | Telemetry Simulator    |             | Database (TimescaleDB / PostgreSQL)  |  |
|  | (Member 3)             |             | (Member 3)                           |  |
|  +-----------+------------+             +------------------+-------------------+  |
|              | HTTP POST                                   ^                      |
|              v                                             | SQL Queries          |
|  +-----------+------------+             +------------------+-------------------+  |
|  | Backend Ingestion API  +------------>| Analytics & Anomaly Service          |  |
|  | & WebSocket Server     | Sensor Stream| (Member 4 - Z-Score/Isolation Forest)|  |
|  | (Member 2)             |             +------------------+-------------------+  |
|  +-----------+------------+                                | Trigger Alert        |
|              | WSS Push                                    v                      |
|              v                          +------------------+-------------------+  |
|  +-----------+------------+             | Notification Dispatch Worker         |  |
|  | Frontend Dashboard UI  |             | (Member 4 - Discord/Telegram/Email)  |  |
|  | (Member 1)             |             +--------------------------------------+  |
|  +------------------------+                                                       |
+-----------------------------------------------------------------------------------+
```

---

## 4. Detailed Component Design & Interfaces

### 4.1 Frontend Architecture (Member 1)
- **State Management:** Manages local reactive state for active devices, chart buffers (last 60 data points), and connection status (`CONNECTING`, `ONLINE`, `DISCONNECTED`).
- **WebSocket Reconnection:** Exponential backoff reconnect strategy ($1\text{s}, 2\text{s}, 4\text{s}, \dots, 30\text{s}$ max).
- **Data Export Module:** Client-side CSV/JSON generator parsing raw JSON logs into downloadable files.

### 4.2 Backend & Rule Engine Architecture (Member 2)
- **Threshold Rule Engine:** Evaluates incoming telemetry against dynamic rules:
  - *Rule Example:* Flag critical alert if `temperature > 35°C` for 3 consecutive readings.
- **REST Endpoints:**
  - `GET /api/v1/devices` — Fetch registered device metadata.
  - `GET /api/v1/telemetry/latest` — Fetch latest telemetry across all sensors.
  - `GET /api/v1/telemetry/history?device_id=X&start=Y&end=Z` — Query aggregated historical records.
  - `POST /api/v1/telemetry/ingest` — Ingest sensor payload.

### 4.3 Database Schema & Aggregation Views (Member 3)
- **Hypertable / Table Schema (`telemetry_logs`):**
  ```sql
  CREATE TABLE telemetry_logs (
      time        TIMESTAMPTZ NOT NULL,
      device_id   VARCHAR(64) NOT NULL,
      temperature DOUBLE PRECISION NOT NULL,
      humidity    DOUBLE PRECISION NOT NULL,
      status      VARCHAR(20) DEFAULT 'NORMAL'
  );
  CREATE INDEX idx_telemetry_device_time ON telemetry_logs (device_id, time DESC);
  ```
- **Continuous Aggregation View (1-Hour Averages):**
  ```sql
  CREATE MATERIALIZED VIEW telemetry_hourly_avg AS
  SELECT time_bucket('1 hour', time) AS hour_bucket,
         device_id,
         AVG(temperature) AS avg_temp,
         AVG(humidity) AS avg_humidity,
         MIN(temperature) AS min_temp,
         MAX(temperature) AS max_temp
  FROM telemetry_logs
  GROUP BY hour_bucket, device_id;
  ```

### 4.4 Analytics & Anomaly Detection Design (Member 4)
- **Z-Score Calculation Engine:**
  $$Z = \frac{X - \mu}{\sigma}$$
  Where $\mu$ is the 60-minute rolling mean and $\sigma$ is the rolling standard deviation per device. An anomaly is flagged if $|Z| > 3.0$.
- **Isolation Forest Classifier:** Fits an unsupervised `IsolationForest` model on feature vector $[T, H, \frac{\Delta T}{\Delta t}, \frac{\Delta H}{\Delta t}]$ to detect multi-dimensional sensor calibration failures or environmental anomalies.
- **Notification Worker Architecture:** Asynchronous worker listening for anomaly events, formatting markdown payload templates, and dispatching to configured webhooks/Discord bots.

---

## 5. Security Architecture & STRIDE Threat Model

| STRIDE Threat Category | Potential Risk in IoT System | Architectural Mitigation |
| :--- | :--- | :--- |
| **Spoofing** | Attacker impersonates an IoT sensor to send fake readings | Token-based API authentication (`X-Sensor-API-Key`) for ingestion endpoints |
| **Tampering** | Man-in-the-middle tampering of sensor payload values in transit | Enforce TLS 1.2+ (HTTPS/WSS) on all incoming and outgoing connections |
| **Information Disclosure**| Unauthenticated user accessing confidential historical telemetry | JWT authorization for REST API routes; CORS policy configuration |
| **Denial of Service (DoS)** | Attacker flooding backend ingestion API with fake messages | Nginx reverse proxy rate-limiting (e.g. 30 requests/sec per IP) |
| **Elevation of Privilege**| Unauthorized user accessing administrative rule-engine controls | Role-Based Access Control (RBAC) separating viewer vs admin tokens |

---

## 6. Sequence Diagrams

### 6.1 Telemetry Ingestion, Analytics & Real-Time Visualization Sequence
```
[Simulator]    [Backend API]    [Database]    [Analytics Worker]   [Notification]   [Frontend UI]
     |               |               |                 |                 |                |
     |-- POST Payload-->|               |                 |                 |                |
     |   (Temp, Hum) |               |                 |                 |                |
     |               |-- Insert DB ->|                 |                 |                |
     |               |-- WS Broadcast --------------------------------------------------->|
     |               |               |                 |                 |        Render Chart
     |               |               |<-- Poll / Stream|                 |                |
     |               |               |   New Readings  |                 |                |
     |               |               |---------------->|                 |                |
     |               |               |                 | Evaluate Z-Score|                |
     |               |               |                 | & Isolation For.|                |
     |               |               |                 | [ANOMALY DETECTED]               |
     |               |               |                 |-- Dispatch Alert-------------->|
     |               |               |                 |   (Discord/Webhook)             |
```
