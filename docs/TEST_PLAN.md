# Software Test Plan (STP)
## Minimal IoT Temperature & Humidity Monitoring Dashboard

**Project Name:** Minimal IoT Dashboard  
**Version:** 1.0  
**Date:** September 2026  
**Repository:** [Minimal-IOT-Dashboard](https://github.com/shreyahegde911-maker/Minimal-IOT-Dashboard)  
**Authors:** IoT Engineering Project Team / QA Lead  

---

## 1. Introduction

### 1.1 Purpose
This Software Test Plan (STP) establishes the testing strategy, test levels, resource requirements, environment setup, and verification criteria for the **Minimal IoT Dashboard**.

### 1.2 Scope
Testing covers:
- Ingestion API correctness & rate limiting.
- Real-time WebSocket broadcasting & auto-reconnect resilience.
- Database time-series indexing, rollup aggregation accuracy, and data pruning.
- Frontend interactive charts, telemetry cards, and CSV/JSON log exports.
- Statistical (Z-Score) & Machine Learning (Isolation Forest) anomaly detection algorithms.
- Multi-channel notification worker dispatching (Discord, Webhooks, Telegram, Email).
- Docker Compose container startup and health monitoring.

---

## 2. Test Strategy & Levels

```
                     +-----------------------+
                     |  Acceptance Testing   | (User workflows, UI export, Alerts)
                     +-----------+-----------+
                                 |
                     +-----------+-----------+
                     |    System Testing     | (End-to-end Docker Compose stack)
                     +-----------+-----------+
                                 |
                     +-----------+-----------+
                     |  Integration Testing  | (Backend <-> DB <-> Analytics)
                     +-----------+-----------+
                                 |
                     +-----------+-----------+
                     |     Unit Testing      | (Pytest analytics, API handlers)
                     +-----------------------+
```

### 2.1 Unit Testing
- **Scope:** Individual functions and modules (Z-Score formulas, Isolation Forest scoring, rate limiter logic, data formatting functions).
- **Tools:** `pytest` (Python), `Jest` / `Mocha` (Node.js).

### 2.2 Integration Testing
- **Scope:** Cross-component interaction:
  - Telemetry Ingestion API inserting records into Database.
  - Backend broadcasting ingested payloads over WebSocket.
  - Analytics service fetching continuous stream from Database/API and producing alert events.

### 2.3 System & Performance Testing
- **Scope:** End-to-end system validation under realistic sensor loads (500+ telemetry points/sec).
- **Tools:** `Locust` / `k6` for API load testing, `docker-compose` health checks.

### 2.4 Security & Resilience Testing
- **Scope:** Input validation (fuzzing sensor inputs), unauthorized API access, rate limiting enforcement, and abrupt container restart testing.

---

## 3. Test Cases & Execution Matrix (Updated for Sprint 1 & Sprint 2)

### 3.1 Ingestion & REST API Validation Tests (Member 2)
| Test Case ID | Test Title | Test Procedure | Expected Result | Pass/Fail Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **TC-VAL-01** | Missing Required Fields | `POST /api/telemetry` with missing `humidity` | HTTP 400 Bad Request; error message returned | HTTP 400 & `success: false` |
| **TC-VAL-02** | Empty Sensor ID | `POST /api/telemetry` with `sensorId: "   "` | HTTP 400 Bad Request | HTTP 400 & invalid ID message |
| **TC-VAL-03** | Non-Numeric Temperature | `POST /api/telemetry` with `temperature: "hot"` | HTTP 400 Bad Request | HTTP 400 & numeric type error |
| **TC-VAL-04** | Out-of-Range Humidity | `POST /api/telemetry` with `humidity: 120` | HTTP 400 Bad Request | HTTP 400 & bounds message |
| **TC-VAL-05** | Invalid Data Non-Persistence | `POST /api/telemetry` with invalid data followed by `GET` | Telemetry log count unchanged; invalid data omitted | Count before == count after |
| **TC-API-01** | Get All Telemetry Records | `GET /api/telemetry` | HTTP 200 OK; returns array of telemetry records | HTTP 200 & `Array.isArray(data)` |
| **TC-API-02** | Get Telemetry by Device ID | `GET /api/telemetry/:sensorId` | HTTP 200 OK; returns device-specific records | HTTP 200 & all IDs match |
| **TC-API-03** | Query Unknown Sensor ID | `GET /api/telemetry/UNKNOWN-SENSOR-999` | HTTP 200 OK with empty data list | HTTP 200 & `count === 0` |
| **TC-WS-01** | WebSocket Stream Broadcast | Ingest telemetry payload while WebSocket client is connected | Client receives JSON broadcast within $\le 200\text{ms}$ | Timestamp & values match ingested payload |
| **TC-WS-02** | WebSocket Graceful Disconnection | Connect WebSocket client, call `disconnect()`, query REST API | Server remains responsive without unhandled exceptions | HTTP 200 on `GET /api/telemetry` |
| **TC-HEALTH-01** | Backend Diagnostic Health Check | Send `GET /api/health` | HTTP 200; returns status, uptime, and timestamp | Status `"healthy"` & `uptime >= 0` |

### 3.2 Database Storage & Rollup Aggregation Tests (Member 3)
| Test Case ID | Test Title | Test Procedure | Expected Result | Pass/Fail Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **TC-DB-01** | Raw Telemetry Hypertable Storage | Insert telemetry record into `telemetry_logs` | Record persisted with timestamp, device_id, temperature, humidity | Record retrievable via SQL query |
| **TC-DB-02** | Minute Aggregate Calculation | Insert 10 readings within 1-minute window | Minute continuous aggregate computes accurate average | Mathematical average matches raw data |
| **TC-DB-03** | Hourly Aggregation Rollup | Query `telemetry_hourly` continuous aggregate view | Returns aggregated row with `avg_temp`, `min_temp`, `max_temp` | Values match calculated window |
| **TC-DB-04** | Daily Aggregation Rollup | Query `telemetry_daily` continuous aggregate view | Returns daily aggregated metrics with 24-hour rollup | Continuous aggregate populated |
| **TC-DB-05** | 30-Day Retention Policy Pruning | Inspect TimescaleDB retention job configuration | Retention policy set to prune raw logs older than 30 days | Policy active on `telemetry_logs` |

### 3.3 Frontend Visualization & Monitoring Tests (Member 1)
| Test Case ID | Test Title | Test Procedure | Expected Result | Pass/Fail Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **TC-UI-01** | Dynamic Live Chart Updating | Connect UI to active WebSocket server | Chart updates dynamically without page refresh | Chart renders new data point immediately |
| **TC-UI-02** | Multi-Device Status Cards | Broadcast telemetry for `sensor-01`, `sensor-02`, `sensor-03` | Status cards display current temp, humidity, and status | Displayed values match received telemetry |
| **TC-UI-03** | Historical Date-Range Filtering | Apply Start and End datetime filters to log table | Historical table updates to display records within window | Rendered records match date range |
| **TC-UI-04** | Historical CSV/JSON Log Export | Click "Export CSV" / "Export JSON" with date filters applied | Triggers download of filtered dataset in chosen format | Exported file contains filtered data |
| **TC-UI-05** | WebSocket Auto-Reconnect | Stop backend server for 5 seconds, then restart | UI displays "Reconnecting...", then restores connection | Reconnect successful without browser refresh |

### 3.4 Analytics, Machine Learning & DevOps Tests (Member 4)
| Test Case ID | Test Title | Test Procedure | Expected Result | Pass/Fail Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **TC-ANOM-01** | Rolling Z-Score Spike Detection | Pass a sudden temperature jump ($+15^\circ\text{C}$ spike) to ZScoreDetector | Algorithm flags reading as ANOMALY ($Z > 3.0$) | Anomaly flag set to True |
| **TC-ANOM-02** | Baseline Buffer Warming Handling | Feed 5 readings to uncalibrated sensor buffer ($< 10$ samples) | Returns `is_anomaly: false` and `z_score: 0.0` until buffer warms | Safe non-blocking initialization |
| **TC-ANOM-03** | Multi-Sensor Rolling Buffer Isolation | Ingest interleaved readings for `sensor-A` and `sensor-B` | Window queues remain completely partitioned per sensor ID | Buffer lengths match sensor feeds |
| **TC-ANOM-04** | Multivariate Rate-of-Change Extraction | Calculate feature vector `[temp, hum, delta_temp, delta_hum]` | Correct first-order difference computed relative to prior reading | Delta values match subtraction |
| **TC-ANOM-05** | Isolation Forest Baseline Training | Fit Isolation Forest on 50 normal telemetry vectors | Model trains successfully and sets `is_fitted = True` | Readiness flag set to True |
| **TC-ANOM-06** | Online Isolation Forest Scoring | Score anomalous vector `[45.0, 10.0, 15.0, -40.0]` | Model predicts negative anomaly score (`prediction == -1`) | Classified as Anomaly |
| **TC-ALERT-01** | Webhook JSON Formatting | Format alert event for Discord and Slack webhooks | JSON embeds contain sensor ID, metric, value, Z-Score, and timestamp | Valid JSON schema with rich fields |
| **TC-ALERT-02** | Alert Cooldown Throttling | Fire 5 consecutive anomaly events within 10 seconds | Notification sent for 1st event; subsequent 4 throttled | Exactly 1 notification emitted |
| **TC-SIM-01** | Multi-Sensor Diurnal Generation | Generate readings across `sensor-01`, `sensor-02`, `sensor-03` | Valid JSON payload with diurnal temperature and inverse humidity | Schema and bounds verified |
| **TC-SIM-02** | High Temperature Spike Injection | Evaluate tick 25 on `sensor-01` | Injects 42.5°C anomaly spike | Temp == 42.5°C on tick 25 |
| **TC-SIM-03** | Freeze & Humidity Drop Injection | Evaluate tick 50 on `sensor-02` and tick 75 on `sensor-03` | Injects -5.0°C freeze on sensor-02; 10.0% humidity on sensor-03 | Bounds breached accurately |
| **TC-SIM-04** | Isolated Dry-Run Execution | Execute `run_cycle(dry_run=True)` | Generates full cycle of readings without network requests | Returns 3 sensor payloads |
| **TC-HEALTH-02** | Health Diagnostics Reporting | Call `HealthDiagnosticRunner.get_system_health()` | Returns structured dict with uptime, buffer metrics, and model status | All health keys present |
| **TC-HEALTH-03** | Diagnostic Self-Check Automation | Execute `HealthDiagnosticRunner.run_self_check()` | Verifies service online, Z-Score configured, and backend connectivity | Returns `healthy: True` |
| **TC-DOCKER-01** | Multi-Container Orchestration | Execute `docker-compose up --build` | TimescaleDB, Backend, Simulator, Analytics start and pass healthchecks | All services healthy (`exit 0`) |

---

## 4. Test Environment & Environment Variables

### 4.1 Test Environment Setup
- **OS:** Linux (Ubuntu 22.04 LTS) / macOS 14+ / Windows 11 with WSL2.
- **Docker Version:** Docker Engine 24.0+, Docker Compose v2.20+.
- **Node.js:** Node 20+ LTS / Node 22.
- **Python:** Python 3.10+ / Python 3.11+.

### 4.2 Entry & Exit Criteria
- **Entry Criteria:** Clean git working tree; database migrations applied; all microservice dependencies installed (`npm ci`, `pip install -r requirements.txt`).
- **Exit Criteria:** $100\%$ of test cases across all test suites pass with 0 critical defects.

---

## 5. Traceability Matrix & Execution Status (Sprint 1 & Sprint 2)

| Requirement ID | Test Case ID | Test Level | Automated Suite | Execution Status |
| :--- | :--- | :--- | :--- | :---: |
| `IOT-FR-001` | **TC-INGEST-01** | Integration | `backend/tests/telemetry.test.js` | ✅ **PASS** |
| `IOT-FR-002` | **TC-VAL-01..05** | Unit | `backend/tests/telemetry.test.js` | ✅ **PASS** |
| `IOT-FR-003` | **TC-SIM-01..04** | Unit | `analytics_alerting/tests/test_simulator.py` | ✅ **PASS** |
| `IOT-FR-004` | **TC-DB-01** | Integration | `database/tests/test_aggregates.py` | ✅ **PASS** |
| `IOT-FR-005` | **TC-DB-02..04** | Integration | `database/tests/test_aggregates.py` | ✅ **PASS** |
| `IOT-FR-006` | **TC-DB-05** | Integration | `database/tests/test_aggregates.py` | ✅ **PASS** |
| `IOT-FR-007` | **TC-WS-01..02** | Integration | `backend/tests/telemetry.test.js` | ✅ **PASS** |
| `IOT-FR-008` | **TC-UI-01`** | Acceptance | `frontend/app.js` (Manual + WebSocket) | ✅ **PASS** |
| `IOT-FR-009` | **TC-UI-02`** | Acceptance | `frontend/app.js` (Manual + WebSocket) | ✅ **PASS** |
| `IOT-FR-010` | **TC-UI-03`** | Acceptance | `frontend/app.js` (Date Range Filter) | ✅ **PASS** |
| `IOT-FR-011` | **TC-UI-04`** | Acceptance | `frontend/app.js` (CSV/JSON Export) | ✅ **PASS** |
| `IOT-FR-012` | **TC-ANOM-01..03** | Unit | `analytics_alerting/tests/test_anomaly_detector.py` | ✅ **PASS** |
| `IOT-FR-013` | **TC-ANOM-04..06** | Unit | `analytics_alerting/tests/test_anomaly_detector.py` | ✅ **PASS** |
| `IOT-FR-014` | **TC-ALERT-01`** | Unit | `analytics_alerting/tests/test_notification_worker.py` | ✅ **PASS** |
| `IOT-FR-015` | **TC-ALERT-02`** | Unit | `analytics_alerting/tests/test_notification_worker.py` | ✅ **PASS** |
| `IOT-FR-016` | **TC-HEALTH-01..03**| Integration | `backend/tests/telemetry.test.js` & `analytics_alerting/tests/test_health.py` | ✅ **PASS** |
| `IOT-NFR-001` | **TC-DOCKER-01** | System | `docker-compose.yml` Health Checks | ✅ **PASS** |
