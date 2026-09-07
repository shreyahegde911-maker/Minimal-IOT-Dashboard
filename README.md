# Minimal IoT Dashboard

A web dashboard simulating temperature and humidity sensor inputs, plotting real-time charts, logging historical data, calculating statistical/ML anomalies, and dispatching alerts.

---

## 📚 Project Documentation & Specifications

The project includes formal Software Engineering (SE) documentation tailored specifically for the Minimal IoT Dashboard:

- 📄 **[Software Requirements Specification (SRS)](docs/SRS.md)** — Functional, non-functional, security requirements, and Requirements Traceability Matrix (RTM).
- 🏗️ **[Software Architecture & Design Specification (SAD)](docs/SAD.md)** — Architectural design, technology stack, database schemas, REST & WebSocket API specifications, sequence diagrams, and STRIDE threat modeling.
- 🧪 **[Software Test Plan (STP)](docs/TEST_PLAN.md)** — Unit, integration, system, performance, and security testing strategy with test case matrices.
- 👥 **[Teammate Guide PDF](docs/Team_Guide_SRS_SAD_TestPlan.pdf)** — Plain-English guide for all team members explaining SRS, SAD, Test Plan, and deliverable mappings.
- 📁 **[Original Templates](docs/templates/)** — Original `.docx` project documentation templates.

---

## 👥 Team Roles & Modules

| Role | Lead | Focus Area | Core Deliverables |
| :--- | :--- | :--- | :--- |
| **Member 1** | Frontend Lead | Client Architecture & Live UI | Live Charts (Chart.js/ECharts), Log Viewer (CSV export), Device Cards, WebSocket Client |
| **Member 2** | Backend Lead | API & Ingestion Pipeline | Ingestion REST APIs, WebSocket/SSE Server, Dynamic Rule Engine, Auth & Rate Limiting |
| **Member 3** | Database Lead | Time-Series Data & Simulator | Hypertable Schemas, Continuous Rollups, Retention Policies, Telemetry Simulator |
| **Member 4** | DevOps Lead | ML Intelligence & DevOps | Anomaly Engine (Z-Score & Isolation Forest), Notification Worker, Docker Compose, CI/CD |

---

## 🚀 Quick Start (Local Setup)

```bash
# Clone repository
git clone https://github.com/shreyahegde911-maker/Minimal-IOT-Dashboard.git
cd Minimal-IOT-Dashboard

# Start multi-container stack via Docker Compose
docker-compose up --build
```
## Backend

The backend of the Minimal IoT Dashboard is built using **Node.js** and **Express.js**.

It is responsible for receiving sensor telemetry, validating the incoming data, providing REST APIs for telemetry retrieval, and broadcasting new telemetry readings in real time using **Socket.IO**.

### Backend Setup

Navigate to the backend directory:

```bash
cd backend
npm install
node server.js
```
