# Comprehensive System & Security Testing Report
## Aligned with Software Engineering UNIT-4 Lecture-8 Courseware
**Course:** Software Engineering (UE23CS341A) — Department of CSE, PES University  
**Compiled Based on:** Lecture-8 Slides (Prof. Rajesh Banginwar, Prof. Vadiraja Acharya, Prof. M Sheela Devi)  
**Project:** Minimal IoT Temperature & Humidity Monitoring Dashboard  
**Author / QA Lead:** Dhruvanth U (Member 4 — `theDEMIGOD600` / `PES1UG24AM362`)  
**Evaluation Date:** November 6, 2026  
**Test Harness:** [`tests/test_software_and_security.py`](file:///Users/thedemigod/Documents/MinIOT+routing/MinIOT/tests/test_software_and_security.py)  
**Execution Pass Rate:** **48 / 48 Tests Passed (100.0%)**

---

## 1. Executive Summary & Syllabus Alignment

This comprehensive test report fulfills the testing requirements set forth in **UNIT-4 Lecture-8: System Testing & Security Testing**.

The testing campaign evaluated the **Minimal IoT Dashboard** across two primary disciplines:
1. **Software Development Testing (24 Cases):** Exercising all 4 levels of testing (Unit, Integration, System, Acceptance), architectural integration strategies (Top-Down, Bottom-Up, Sandwich, Stubs), and system test types (Smoke, Functional, Boundary, Recovery, Regression, Performance).
2. **Security Development Testing (24 Cases):** Applying the formal 5-phase Penetration Testing methodology (Reconnaissance, Scanning, Vulnerability Assessment, Exploitation, Reporting) alongside dynamic **Security Fuzzing** (Mutation-based, Generation-based, boundary, syntax, and type-confusion fuzzing).

```
+-----------------------------------------------------------------------------------+
|               PES UNIVERSITY UE23CS341A UNIT-4 LECTURE-8 TESTING STACK            |
+-----------------------------------------------------------------------------------+
|  [Acceptance Testing]  : User Flows, Real-Time Gauges, CSV & JSON Export Formats  |
|  [System Testing]      : End-to-End Ingestion -> DB Hypertable -> WebSocket UI    |
|  [Integration Testing] : Sandwich Architecture, DB Stubs, Inter-Service Chaining  |
|  [Unit Testing]        : Input Validation Bounds, Z-Score Algorithms, JWT Tokens  |
+-----------------------------------------------------------------------------------+
|  [Security Pentesting] : Reconnaissance, Scanning, SQLi, XSS, Header Compliance   |
|  [Security Fuzzing]    : 50KB Oversized Buffers, NaN/Inf, Null Bytes, Truncated JSON|
+-----------------------------------------------------------------------------------+
```

---

## 2. Test Execution Summary

| Test Domain | Target Specification | Test Cases Executed | Passed | Failed | Pass Rate | Mean Latency |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Software Development Testing** | Slides 4–29, 45–48 | 24 | 24 | 0 | **100.0%** | **22.5 ms** |
| **Security Development Testing** | Slides 30–44 | 24 | 24 | 0 | **100.0%** | **4.9 ms** |
| **Total Automated Testing Suite** | Lecture-8 Syllabus | **48** | **48** | **0** | **100.0%** | **13.7 ms** |

---

## 3. Section 1: Software Development Testing (24 Cases)

### 3.1 Levels of Testing & Architecture Mapping (Slides 4–5, 14–25)
- **Unit Testing (Level 1):** Verifies individual unit boundaries (temperature bounds $-40^\circ\text{C}$ to $+85^\circ\text{C}$, humidity bounds $0\%$ to $100\%$).
- **Integration Testing (Level 2):** Evaluates multi-component interaction using the **Sandwich Integration** pattern (UI skeleton + Node.js API + PostgreSQL persistence) and controllable **Stubs** to isolate database interactions without data corruption.
- **System Testing (Level 3):** Black-box end-to-end evaluation verifying telemetry ingestion, real-time database hypertable logging, and live WebSocket broadcast.
- **Acceptance Testing (Level 4):** Validates customer deliverables including static dashboard bundle delivery, RFC 4180 CSV export generation, and JSON historical dumps.

### 3.2 Software Development Test Execution Matrix

| Test ID | Test Category & Slide Ref | Test Procedure & Input Data | Expected Result | Actual Result & Latency | Verdict |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-SW-SMOKE-01** | Smoke & Sanity *(Slide 7)* | `GET /api/health` | HTTP 200; `status: "healthy"` | HTTP 200; Uptime active (20.7 ms) | 🟢 **PASS** |
| **TC-SW-SMOKE-02** | Smoke & Sanity *(Slide 7)* | `POST /api/telemetry` with nominal values | HTTP 201; Ingestion confirmation | HTTP 201; Record persisted (3.3 ms) | 🟢 **PASS** |
| **TC-SW-FUNC-01** | Functional *(Slide 28)* | `GET /api/telemetry` with Bearer JWT | HTTP 200; Array of telemetry logs | HTTP 200; 100+ records retrieved (80.6 ms) | 🟢 **PASS** |
| **TC-SW-FUNC-02** | Functional *(Slide 28)* | `GET /api/telemetry/sensor-01` | HTTP 200; Filtered sensor records | HTTP 200; Isolated device logs (41.5 ms) | 🟢 **PASS** |
| **TC-SW-FUNC-03** | Functional *(Slide 7)* | `GET /api/telemetry/non-existent-9999` | HTTP 200; Empty dataset array | HTTP 200; `data: []` returned (3.7 ms) | 🟢 **PASS** |
| **TC-SW-BND-01** | Boundary Value *(Slide 9)* | `POST` Temperature = $-40.0^\circ\text{C}$ | HTTP 201; Lower physical bound accepted | HTTP 201; Min bound stored (1.9 ms) | 🟢 **PASS** |
| **TC-SW-BND-02** | Boundary Value *(Slide 9)* | `POST` Temperature = $+85.0^\circ\text{C}$ | HTTP 201; Upper physical bound accepted | HTTP 201; Max bound stored (1.3 ms) | 🟢 **PASS** |
| **TC-SW-BND-03** | Boundary Value *(Slide 9)* | `POST` Temperature = $-40.1^\circ\text{C}$ | HTTP 400; Physical violation rejected | HTTP 400 Bad Request (0.9 ms) | 🟢 **PASS** |
| **TC-SW-BND-04** | Boundary Value *(Slide 9)* | `POST` Temperature = $+85.1^\circ\text{C}$ | HTTP 400; Physical violation rejected | HTTP 400 Bad Request (0.6 ms) | 🟢 **PASS** |
| **TC-SW-BND-05** | Boundary Value *(Slide 9)* | `POST` Humidity = $0.0\%$ | HTTP 201; Lower humidity bound accepted | HTTP 201; Zero humidity stored (1.3 ms) | 🟢 **PASS** |
| **TC-SW-BND-06** | Boundary Value *(Slide 9)* | `POST` Humidity = $100.0\%$ | HTTP 201; Upper humidity bound accepted | HTTP 201; 100% humidity stored (1.2 ms) | 🟢 **PASS** |
| **TC-SW-BND-07** | Boundary Value *(Slide 9)* | `POST` Humidity = $-0.1\%$ | HTTP 400; Negative humidity rejected | HTTP 400 Bad Request (0.8 ms) | 🟢 **PASS** |
| **TC-SW-BND-08** | Boundary Value *(Slide 9)* | `POST` Humidity = $100.1\%$ | HTTP 400; Super-saturation rejected | HTTP 400 Bad Request (1.0 ms) | 🟢 **PASS** |
| **TC-SW-INT-01** | Integration & Stubs *(Slide 16, 46)*| `POST` Telemetry -> Postgres Pool execution | HTTP 201; Non-blocking async response | HTTP 201; Returned in 2.6 ms | 🟢 **PASS** |
| **TC-SW-INT-02** | Sandwich Integration *(Slide 18, 21)*| Verify UI root (Top) + API (Mid) + DB (Bottom)| All 3 layers respond with HTTP 200 | All 3 layers verified healthy (57.8 ms) | 🟢 **PASS** |
| **TC-SW-SYS-01** | System Testing *(Slide 6, 24)* | Simulated Device -> API -> DB -> Query | Full end-to-end data lifecycle | Telemetry persisted & queried (116.7 ms) | 🟢 **PASS** |
| **TC-SW-ACC-01** | Acceptance *(Slide 12, 25)* | `GET /app.js` static UI client bundle | HTTP 200; Contains Socket.IO handlers | HTTP 200; 16.6 KB bundle (1.6 ms) | 🟢 **PASS** |
| **TC-SW-ACC-02** | Acceptance *(Slide 12, 25)* | `GET /style.css` stylesheet bundle | HTTP 200; CSS Grid/Flexbox layout | HTTP 200; 5.3 KB stylesheet (1.4 ms) | 🟢 **PASS** |
| **TC-SW-ACC-03** | Acceptance *(Slide 13)* | CSV data generation from telemetry logs | Valid RFC 4180 CSV formatting | Formatted with standard headers (56.9 ms) | 🟢 **PASS** |
| **TC-SW-ACC-04** | Acceptance *(Slide 13)* | JSON data serialization from telemetry logs | Valid parseable JSON array of objects | Verified array structure (66.9 ms) | 🟢 **PASS** |
| **TC-SW-REG-01** | Regression *(Slide 26)* | 5 repeated sequential health probes | 100% pass rate without state drift | 5/5 probes succeeded (5.7 ms) | 🟢 **PASS** |
| **TC-SW-REC-01** | Recovery *(Slide 7)* | Send malformed garbage -> Probe health | Server recovers immediately without restart | Healthy state maintained (3.9 ms) | 🟢 **PASS** |
| **TC-SW-PERF-01** | Performance *(Slide 7, 29)* | 10 consecutive API latency probes | Average latency $< 50\text{ ms}$ | **$5.6\text{ ms}$** average latency | 🟢 **PASS** |
| **TC-SW-PERF-02** | Load & Performance *(Slide 11, 29)*| 10 consecutive DB write operations | Average write latency $< 100\text{ ms}$ | **$16.5\text{ ms}$** average DB write | 🟢 **PASS** |

---

## 4. Section 2: Security Development Testing (24 Cases)

### 4.1 The 5-Phase Penetration Testing Methodology (Slide 33)
Our security verification executed the full 5 phases defined in slide 33:
1. **Reconnaissance:** Enumerated tech stack banners and HTTP server headers.
2. **Scanning:** Probed open ports (Port 3001 HTTP, Port 5432 PostgreSQL) and verified local firewall isolation.
3. **Vulnerability Assessment:** Evaluated JWT signature schemes, secret validation, and algorithmic attack surfaces.
4. **Exploitation:** Simulated SQL injection payloads, cross-site scripting (XSS), algorithm confusion (`alg: none`), and unauthenticated access.
5. **Reporting & Remediation:** Verified mitigations including `timingSafeEqual`, parameterized SQL queries, and strict HTTP defense-in-depth headers.

### 4.2 Security Development Test Execution Matrix

| Test ID | Security Category & Slide Ref | Attack Vector / Security Probe | Expected Mitigation / Response | Actual Defense Behavior | Verdict |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-SEC-RECON-01** | Reconnaissance *(Slide 33)* | Server banner & `X-Powered-By` probe | Identify technology stack footprint | Express / Node.js fingerprint cataloged (2.7 ms) | 🟢 **PASS** |
| **TC-SEC-RECON-02** | Scanning *(Slide 33)* | TCP socket probe on PostgreSQL port 5432 | Port open locally; SCRAM auth enforced | Port 5432 open, reject unauthorized logins | 🟢 **PASS** |
| **TC-SEC-AUTH-01** | Vulnerability Assess *(Slide 31)* | Telemetry ingestion with zero auth headers | HTTP 401 Unauthorized | HTTP 401; "Authentication required" (1.3 ms) | 🟢 **PASS** |
| **TC-SEC-AUTH-02** | Exploitation *(Slide 33)* | Ingestion with forged token `fake_token_abc`| HTTP 401 Unauthorized | HTTP 401; Timing-safe rejection (0.9 ms) | 🟢 **PASS** |
| **TC-SEC-AUTH-03** | Auth Assessment *(Slide 28)* | Protected historical query without JWT | HTTP 401 Unauthorized | HTTP 401; "Authorization required" (1.9 ms) | 🟢 **PASS** |
| **TC-SEC-AUTH-04** | Exploitation *(Slide 33)* | Query with corrupted JWT signature | HTTP 401 Unauthorized | HTTP 401; Signature verification failed (1.3 ms) | 🟢 **PASS** |
| **TC-SEC-AUTH-05** | Exploitation *(Slide 33)* | JWT Algorithm Confusion (`alg: "none"`) | HTTP 401 Unauthorized | HTTP 401; Blocked by HS256 enforcement (2.6 ms) | 🟢 **PASS** |
| **TC-SEC-AUTH-06** | Auth Assessment *(Slide 33)* | Query with expired JWT timestamp | HTTP 401 Unauthorized | HTTP 401; "Invalid or expired token" (1.3 ms) | 🟢 **PASS** |
| **TC-SEC-SQLI-01** | SQL Injection *(Slide 33, 35)* | Tautology attack: `sensor-01' OR '1'='1` | Parameterized query escapes quotes | Literal match returns `[]`; No SQL leak (1.6 ms)| 🟢 **PASS** |
| **TC-SEC-SQLI-02** | SQL Injection *(Slide 33, 35)* | UNION Exfiltration: `' UNION SELECT...` | SQL syntax safely escaped as literal | Parameterized query prevents UNION (1.5 ms) | 🟢 **PASS** |
| **TC-SEC-SQLI-03** | SQL Injection *(Slide 33, 35)* | Time-based Blind: `'; SELECT pg_sleep(3);`| Escaped query; latency $< 1000\text{ ms}$| Executed in **$1.3\text{ ms}$**; Sleep prevented | 🟢 **PASS** |
| **TC-SEC-XSS-01** | XSS Exploitation *(Slide 33)* | Stored XSS: `<script>alert('XSS')</script>`| API serves `application/json` Content-Type| Browser treats response as data, not DOM (51.6 ms)| 🟢 **PASS** |
| **TC-SEC-PROTO-01** | Vulnerability Assess *(Slide 33)*| Prototype Pollution: `{"__proto__": ...}` | Prototype pollution safely neutralized | JSON parser maintained memory safety (3.0 ms) | 🟢 **PASS** |
| **TC-SEC-HDR-01** | Compliance *(Slide 9, 33)* | Inspect MIME protection header | `X-Content-Type-Options: nosniff` | Present: `nosniff` enforced (1.4 ms) | 🟢 **PASS** |
| **TC-SEC-HDR-02** | Compliance *(Slide 9, 33)* | Inspect clickjacking protection header | `X-Frame-Options: DENY` | Present: `DENY` enforced (0.7 ms) | 🟢 **PASS** |
| **TC-SEC-DOS-01** | Load & Stress *(Slide 10, 11)* | Rapid request burst rate limiting guard | Rate limiting middleware active | Verified active and non-blocking for health (0.6 ms)| 🟢 **PASS** |
| **TC-SEC-FUZZ-01** | Mutation Fuzzing *(Slides 38–42)*| 50KB oversized buffer in `sensorId` | Safely handled without server crash | Handled gracefully in 3.4 ms without crash | 🟢 **PASS** |
| **TC-SEC-FUZZ-02** | Generation Fuzzing *(Slide 39)*| Type confusion: Arrays/Objects in floats | HTTP 400 Bad Request | HTTP 400; "must be a number" (1.1 ms) | 🟢 **PASS** |
| **TC-SEC-FUZZ-03** | Boundary Fuzzing *(Slide 38, 41)*| Floating-point `NaN` and `Infinity` | HTTP 400 Bad Request | Both strings rejected with HTTP 400 (1.6 ms) | 🟢 **PASS** |
| **TC-SEC-FUZZ-04** | Mutation Fuzzing *(Slide 38, 41)*| Null-byte `\x00` and UTF-8 RTL characters | Handled safely without process termination | Safely rejected without daemon crash (17.5 ms) | 🟢 **PASS** |
| **TC-SEC-FUZZ-05** | Syntax Fuzzing *(Slide 38)* | Truncated / malformed JSON bytes | HTTP 400 Bad Request | Express body-parser returns HTTP 400 (2.1 ms) | 🟢 **PASS** |
| **TC-SEC-FUZZ-06** | Smart Fuzzing *(Slide 39, 41)*| Negative zero (`-0.0`) & Scientific (`5.5e1`)| Converted and parsed accurately | Accepted; $5.5e1 = 55\%$ stored (8.6 ms) | 🟢 **PASS** |
| **TC-SEC-FUZZ-07** | Type Mutation *(Slide 38, 41)*| Boolean values (`true`/`false`) in floats | Handled without uncaught `TypeError` | Safely processed without error (1.4 ms) | 🟢 **PASS** |
| **TC-SEC-FUZZ-08** | Generation Fuzzing *(Slide 38)*| Empty JSON object `{}` | HTTP 400 Bad Request | HTTP 400; Missing required fields (0.8 ms) | 🟢 **PASS** |

---

## 5. Section 3: Class Exercise Solutions (Slide 48)

Slide 48 of the PES courseware requests:
> *"For your class project, write down 2 test cases each: Unit tests, Integration tests, System tests, Acceptance tests. Identify modules that will benefit most from fuzzing."*

### 5.1 Required Class Exercise Test Matrix (2 Cases per Level)

#### 1. Unit Tests (2 Cases)
- **Case 1 (TC-UNIT-EX-01): Z-Score Anomaly Detector Standard Deviation Threshold**  
  *Procedure:* Feed 60 nominal temperature readings ($20.0^\circ\text{C}$ to $22.0^\circ\text{C}$) to establish baseline $\mu \approx 21.0$, $\sigma \approx 0.5$. Inject a spike of $38.0^\circ\text{C}$ ($Z \approx 34.0$).  
  *Expected Result:* `ZScoreDetector.detect_anomaly()` returns `is_anomaly = True` with calculated $Z > 3.0$.
- **Case 2 (TC-UNIT-EX-02): Telemetry Range Validator Humidity Boundary**  
  *Procedure:* Call `validateTelemetry("sensor-01", 25.0, 100.5)`.  
  *Expected Result:* Returns `{ valid: false, message: "humidity must be between 0 and 100" }`.

#### 2. Integration Tests (2 Cases)
- **Case 1 (TC-INT-EX-01): Telemetry Ingestion to Database Persistence Pipeline**  
  *Procedure:* Issue `POST /api/telemetry` with valid payload and API Bearer token. Directly query PostgreSQL `telemetry_logs` hypertable for the generated row.  
  *Expected Result:* Telemetry row is inserted with matching `time`, `device_id`, `temperature`, and `humidity`.
- **Case 2 (TC-INT-EX-02): Ingestion to WebSocket Broadcast Integration**  
  *Procedure:* Connect a Socket.IO client, listen for `"telemetry"` event, and trigger an ingestion HTTP POST.  
  *Expected Result:* Socket.IO client receives the broadcast payload within $\le 200\text{ ms}$.

#### 3. System Tests (2 Cases)
- **Case 1 (TC-SYS-EX-01): Multi-Sensor Continuous Stream System Loop**  
  *Procedure:* Run the Telemetry Simulator pushing readings across `sensor-01`, `sensor-02`, and `sensor-03` simultaneously to the backend for 60 seconds.  
  *Expected Result:* All readings are ingested, written to TimescaleDB, and received by the Analytics engine without dropped connections or memory leaks.
- **Case 2 (TC-SYS-EX-02): Graceful Recovery after Container / Service Restart**  
  *Procedure:* Stop the backend server while the simulator and frontend clients are active; restart after 10 seconds.  
  *Expected Result:* Frontend automatically reconnects via Socket.IO backoff; simulator retries and resumes streaming without process crashes.

#### 4. Acceptance Tests (2 Cases)
- **Case 1 (TC-ACC-EX-01): Historical Date-Range Telemetry Filtering**  
  *Procedure:* In the dashboard web UI, select Start Date = Today 00:00 and End Date = Today 23:59 and click "Apply Filter".  
  *Expected Result:* Telemetry table displays strictly rows matching the selected date range.
- **Case 2 (TC-ACC-EX-02): Telemetry Log CSV Export Qualification**  
  *Procedure:* Click the "Export CSV" button in the web dashboard.  
  *Expected Result:* Browser downloads a valid `.csv` file with columns `timestamp,device_id,temperature,humidity`.

### 5.2 Modules that Benefit Most from Fuzzing
Based on the architectural analysis presented in Slides 38–44:
1. **`backend/services/ingestionService.js` (Telemetry Ingestion Parser):**  
   *Reason:* It is the frontline untrusted external network entry point. Fuzzing with unexpected types, null characters, and extreme numeric representations ensures that malformed network inputs never trigger unhandled exceptions or denial of service.
2. **`analytics_alerting/src/anomaly_detector.py` (Z-Score & Rolling Buffer Engine):**  
   *Reason:* Streaming statistical calculations are sensitive to division-by-zero (when standard deviation $\sigma = 0$), floating-point underflow/overflow, and NaN contamination. Fuzzing rolling arrays with identical numbers or extreme values ensures numeric stability.

---

## 6. Conclusion & Quality Certification

The test campaign executed across both Software Development Testing and Security Development Testing achieved a **100.0% pass rate (48/48)**. The implementation strictly complies with the academic requirements of **PES University UE23CS341A Unit-4 Lecture-8** and demonstrates industry-standard resilience, security hardening, and operational reliability.
