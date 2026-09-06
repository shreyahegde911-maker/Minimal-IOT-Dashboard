# Software Requirements Specification (SRS)
## Minimal IoT Temperature & Humidity Monitoring Dashboard

**Project Name:** Minimal IoT Dashboard  
**Version:** 1.0  
**Date:** September 2026  
**Repository:** [Minimal-IOT-Dashboard](https://github.com/shreyahegde911-maker/Minimal-IOT-Dashboard)  
**Authors:** IoT Engineering Project Team  

---

## 1. Introduction

### 1.1 Purpose
This Software Requirements Specification (SRS) defines the functional, non-functional, security, and interface requirements for the **Minimal IoT Dashboard**. The system provides real-time telemetry ingestion, historical time-series logging, automated anomaly detection, threshold alerting, and interactive web visualization for temperature and humidity sensors.

### 1.2 Scope
The Minimal IoT Dashboard is a full-stack IoT monitoring system designed for real-time sensor data streaming, automated analytics, and responsive user interaction. 

The system encompasses:
- **Telemetry Ingestion & Simulation:** Dynamic generation and API/WebSocket ingestion of simulated temperature (°C) and humidity (%) telemetry.
- **Data Persistence & Rollups:** Time-series storage (TimescaleDB / PostgreSQL / MongoDB) with continuous aggregation pipelines (1-min, 1-hr, 1-day rollups) and data retention pruning.
- **Real-Time Visualization:** Responsive dashboard with live interactive charts, device status cards, and historical log viewers with CSV/JSON exports.
- **Analytics & Alerting:** Statistical (Z-Score) and Machine Learning (Isolation Forest) anomaly detection coupled with multi-channel alert workers (Webhooks, Discord, Telegram, Email).
- **Containerized DevOps:** Production-ready multi-container orchestration using Docker Compose and GitHub Actions CI/CD.

### 1.3 Intended Audience
This document is intended for project team members, software engineers, DevOps leads, course instructors, and QA testers.

---

## 2. Team Role Mapping & Responsibilities

| Role | Lead | Core Module Focus | Key Deliverables |
| :--- | :--- | :--- | :--- |
| **Member 1** | Frontend Lead | Web UI & Client Architecture | Live Charts (Chart.js/ECharts), Historical Log Viewer, Telemetry Cards, WebSocket Client |
| **Member 2** | Backend Lead | API & Ingestion Pipeline | REST APIs, WebSocket/SSE Server, Dynamic Rule Engine, Auth & Rate Limiting |
| **Member 3** | Database Lead | Data Storage & Simulator | Time-Series Schema, Continuous Aggregations, Multi-Sensor Simulator, Retention Policies |
| **Member 4** | DevOps Lead | ML Intelligence & DevOps | Anomaly Engine (Z-Score/Isolation Forest), Notification Dispatcher, Docker Compose, CI/CD |

---

## 3. Overall System Description

### 3.1 Product Perspective
The Minimal IoT Dashboard operates as a containerized microservice ecosystem:
```
[ Telemetry Simulator ] ---> [ Backend Ingestion API / WS ] ---> [ TimescaleDB / Postgres ]
                                      |                                   |
                                      v                                   v
                             [ WebSocket Broadcast ]            [ Analytics & Anomaly Engine ]
                                      |                                   |
                                      v                                   v
                             [ Frontend Live UI ]               [ Notification Worker (Discord/Email) ]
```

### 3.2 Operating Environment
- **Server Environment:** Docker & Docker Compose on Linux/macOS/Windows.
- **Database:** TimescaleDB / PostgreSQL 15+ / MongoDB.
- **Runtime Environment:** Node.js (v18+) or Python (3.10+), Nginx web server.
- **Client Browsers:** Modern Web Browsers (Chrome, Firefox, Safari, Edge).

---

## 4. Functional Requirements (FRs)

### 4.1 Telemetry Ingestion & Ingest Pipeline (Member 2 & Member 3)
- **IOT-FR-001:** The system **shall** ingest sensor telemetry payloads containing `device_id`, `timestamp` (ISO 8601), `temperature` (°C), and `humidity` (%) at configurable intervals (default: 1-minute intervals).
- **IOT-FR-002:** The system **shall** validate incoming telemetry payloads for correct data types and ranges (Temperature: -40°C to +85°C, Humidity: 0% to 100%).
- **IOT-FR-003:** The simulator **shall** generate realistic diurnal temperature curves, natural humidity fluctuations, and injected noise/spikes for testing.

### 4.2 Time-Series Data Management & Aggregations (Member 3)
- **IOT-FR-010:** The database **shall** store raw sensor logs with time-series indexing.
- **IOT-FR-011:** The database **shall** compute automated rollups (1-minute, 1-hour, 1-day averages, minimums, maximums) for high-performance historical queries.
- **IOT-FR-012:** The database **shall** execute automated data retention policies to downsample or prune raw telemetry older than a configured threshold (e.g., 30 days).

### 4.3 REST & Real-Time Communication APIs (Member 2)
- **IOT-FR-020:** The backend **shall** expose REST API endpoints for fetching device registries, latest telemetry, historical log queries, and system health status.
- **IOT-FR-021:** The backend **shall** provide a WebSocket / SSE endpoint to broadcast live sensor readings to connected clients.
- **IOT-FR-022:** The backend **shall** enforce API rate limiting and token-based route protection.

### 4.4 Real-Time Visualization & Dashboard UI (Member 1)
- **IOT-FR-030:** The client **shall** render interactive live charts (Chart.js / ECharts / uPlot) that dynamically update upon receiving new WebSocket readings without full-page reloads.
- **IOT-FR-031:** The client **shall** display real-time status cards showing online/offline status, min/max/avg stats, and live telemetry gauges per device.
- **IOT-FR-032:** The client **shall** include a historical log viewer with date-range filters and data export functionality in CSV and JSON formats.
- **IOT-FR-033:** The client **shall** implement auto-reconnect logic for WebSocket drops with visual reconnection indicators.

### 4.5 Analytics, Anomaly Engine & Alerting (Member 4)
- **IOT-FR-040:** The analytics service **shall** compute rolling Z-Scores on temperature/humidity streams to flag sudden spikes, drops, or sensor drift.
- **IOT-FR-041:** The analytics service **shall** run an Isolation Forest machine learning model to evaluate multi-feature anomaly scores.
- **IOT-FR-042:** The notification worker **shall** dispatch real-time alerts to configured external webhooks, Discord/Telegram channels, or Email when threshold breaches (e.g., Temp > 35°C for 3 consecutive readings) or anomalies occur.
- **IOT-FR-043:** The notification worker **shall** enforce alert throttling/cooldown logic to prevent notification flooding.

---

## 5. Non-Functional Requirements (NFRs)

### 5.1 Performance Requirements
- **IOT-NFR-001 (Latency):** WebSocket broadcast latency from backend ingestion to frontend chart rendering shall be $\le 200\text{ ms}$.
- **IOT-NFR-002 (Throughput):** The system shall handle ingestion of at least 500 telemetry messages per second without dropping frames.
- **IOT-NFR-003 (Query Response):** Historical data queries spanning up to 30 days of aggregated data shall return in $\le 1.0\text{ second}$.

### 5.2 Reliability & Availability
- **IOT-NFR-010 (Availability):** The system shall maintain $\ge 99.9\%$ operational uptime.
- **IOT-NFR-011 (Fault Tolerance):** If the backend or database temporarily goes offline, the frontend client and simulator shall handle reconnects gracefully without crashing.

### 5.3 Security & Compliance
- **IOT-NFR-020 (Encryption):** All external API and WebSocket communications shall use TLS 1.2+ (HTTPS/WSS).
- **IOT-NFR-021 (Authentication):** Sensitive management endpoints shall require JWT (JSON Web Token) authentication.

---

## 6. Requirements Traceability Matrix (RTM)

| Requirement ID | Description | Primary Owner | Module / Component | Test Case Ref |
| :--- | :--- | :--- | :--- | :--- |
| **IOT-FR-001** | Telemetry Payload Ingestion | Member 2 | `backend/ingestion` | `TC-INGEST-01` |
| **IOT-FR-003** | Multi-Sensor Data Simulator | Member 3 | `simulator/` | `TC-SIM-01` |
| **IOT-FR-010** | Time-Series Database Schema | Member 3 | `database/schema` | `TC-DB-01` |
| **IOT-FR-020** | REST Telemetry APIs | Member 2 | `backend/api` | `TC-API-01` |
| **IOT-FR-021** | WebSocket Telemetry Broadcast | Member 2 | `backend/websocket` | `TC-WS-01` |
| **IOT-FR-030** | Interactive Live Charts | Member 1 | `frontend/charts` | `TC-UI-01` |
| **IOT-FR-032** | Historical Log Export (CSV/JSON)| Member 1 | `frontend/export` | `TC-UI-02` |
| **IOT-FR-040** | Z-Score Anomaly Detector | Member 4 | `analytics/zscore` | `TC-ANOM-01` |
| **IOT-FR-041** | Isolation Forest ML Model | Member 4 | `analytics/ml` | `TC-ANOM-02` |
| **IOT-FR-042** | Notification Dispatcher | Member 4 | `analytics/alerting` | `TC-ALERT-01` |
| **IOT-NFR-001** | Sub-200ms Latency | Member 1 & 2 | `backend` + `frontend` | `TC-PERF-01` |
| **IOT-NFR-020** | TLS & Token Security | Member 2 & 4 | `devops/nginx` | `TC-SEC-01` |
