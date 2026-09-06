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

## 3. Test Cases & Execution Matrix

### 3.1 Ingestion & Backend Tests (Member 2)
| Test Case ID | Test Title | Test Procedure | Expected Result | Pass/Fail Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **TC-INGEST-01** | Valid Telemetry Payload Ingestion | Send valid JSON payload (`temp: 24.5`, `humidity: 55.0`) to `POST /api/v1/telemetry/ingest` | HTTP 201 Created; Payload saved to DB | Status 201 & DB record matches |
| **TC-INGEST-02** | Invalid Out-of-Bound Ingestion | Send payload with `temp: 150.0` (°C out of bounds) | HTTP 400 Bad Request | Payload rejected with validation error message |
| **TC-WS-01** | WebSocket Stream Broadcast | Ingest telemetry payload while WebSocket client is connected | Client receives JSON broadcast within $\le 200\text{ms}$ | Timestamp & values match ingested payload |
| **TC-SEC-01** | API Rate Limiting | Send 50 HTTP requests within 1 second from single IP | First 30 succeed; subsequent return HTTP 429 | HTTP 429 Too Many Requests |

### 3.2 Database & Simulator Tests (Member 3)
| Test Case ID | Test Title | Test Procedure | Expected Result | Pass/Fail Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **TC-SIM-01** | Multi-Sensor Data Generation | Run simulator for 10 minutes | Generates diurnal temperature curve & humidity noise | 100% valid payloads emitted without crashes |
| **TC-DB-01** | Hourly Aggregation Rollup | Insert 60 minute readings for `device-01` and execute hourly rollup query | Returns single row with correct `avg_temp`, `min_temp`, `max_temp` | Mathematical average matches raw log calculations |
| **TC-DB-02** | Data Retention Policy Pruning | Set retention threshold to 7 days and execute cleanup job | Records older than 7 days are pruned/downsampled | Zero raw logs older than threshold remain |

### 3.3 Frontend Visualization Tests (Member 1)
| Test Case ID | Test Title | Test Procedure | Expected Result | Pass/Fail Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **TC-UI-01** | Dynamic Live Chart Updating | Connect UI to active WebSocket server | Chart updates dynamically without page refresh | Chart renders new data point immediately |
| **TC-UI-02** | Historical CSV Data Export | Click "Export CSV" button in Historical Log Viewer | Browser triggers download of `.csv` file | CSV contains accurate timestamps and values |
| **TC-UI-03** | WebSocket Auto-Reconnect | Stop backend server for 5 seconds, then restart | UI displays "Reconnecting...", then restores connection | Reconnect successful without browser refresh |

### 3.4 Analytics & DevOps Tests (Member 4)
| Test Case ID | Test Title | Test Procedure | Expected Result | Pass/Fail Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **TC-ANOM-01** | Z-Score Spike Detection | Pass a sudden temperature jump ($+15^\circ\text{C}$ spike) to ZScoreDetector | Algorithm flags reading as ANOMALY ($Z > 3.0$) | Anomaly flag set to True |
| **TC-ANOM-02** | Isolation Forest Scoring | Pass multi-feature anomaly payload (correlated temp spike + humidity drop) | Isolation Forest outputs negative anomaly score ($< 0$) | Classified as Anomaly |
| **TC-ALERT-01**| Discord Notification Worker | Trigger threshold alert (`temp > 35°C`) | Alert worker posts formatted message to Discord webhook | Webhook receives HTTP 200 & formatted markdown |
| **TC-ALERT-02**| Alert Cooldown Throttling | Fire 5 consecutive anomaly events within 10 seconds | Notification sent for 1st event; subsequent 4 throttled | Exactly 1 notification received |
| **TC-DOCKER-01**| Multi-Container Orchestration | Execute `docker-compose up --build` | All 5 containers start and pass health checks | All services running & healthy (`exit 0`) |

---

## 4. Test Environment & Environment Variables

### 4.1 Test Environment Setup
- **OS:** Linux (Ubuntu 22.04) / macOS 13+ / Windows 11 with WSL2.
- **Docker Version:** Docker Engine 24.0+, Docker Compose v2.20+.
- **Node.js:** Node 18 LTS.
- **Python:** Python 3.10+.

### 4.2 Entry & Exit Criteria
- **Entry Criteria:** Docker build passes; unit test suite executes clean; database migrations applied.
- **Exit Criteria:** $100\%$ of mandatory test cases (`TC-INGEST`, `TC-DB`, `TC-UI`, `TC-ANOM`, `TC-ALERT`, `TC-DOCKER`) pass with 0 critical defects.
