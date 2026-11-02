# Minimal IoT Dashboard — Backend Documentation

The backend service is built using **Node.js** and **Express.js**, responsible for sensor telemetry ingestion, PostgreSQL/TimescaleDB persistence, real-time WebSocket broadcasting via **Socket.IO**, and protected REST APIs.

---

## 🔐 Layered Authentication & Security Architecture

The backend implements a scoped, layered security model combining **Rate Limiting**, **API Token Authentication**, and **JWT Authentication**:

1. **Rate Limiting (`backend/middleware/rateLimiter.js`):**
   - Applies an IP-based request throttle (`apiLimiter`) across `/api/telemetry` endpoints using `express-rate-limit`.
   - Prevents volumetric abuse, DoS attacks, and brute-force traffic by returning HTTP `429 Too Many Requests`.

2. **API Token Authentication (`backend/middleware/apiTokenAuth.js`):**
   - Protects sensor telemetry ingestion (`POST /api/telemetry`).
   - Verifies the static device/system token (`API_TOKEN`) using timing-safe buffer comparison to prevent side-channel timing attacks.

3. **JWT Authentication (`backend/middleware/jwtAuth.js` — IOT-NFR-021):**
   - Protects sensitive telemetry retrieval queries (`GET /api/telemetry*`).
   - Verifies JWT signatures with `HS256` and strict algorithm restriction (`algorithms: ["HS256"]`).
   - Rejects missing, malformed, expired, or invalid tokens with HTTP `401 Unauthorized`.
   - Attaches verified claims to `req.user`.

### Endpoint & Credential Matrix

| Method | Endpoint | Required Credential | Header Format | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/telemetry` | **API Token** (`API_TOKEN`) | `Authorization: Bearer <API_TOKEN>` | Sensor ingestion pipeline |
| `GET` | `/api/telemetry` | **JWT** (`JWT_SECRET`) | `Authorization: Bearer <JWT_TOKEN>` | Retrieves stored telemetry records |
| `GET` | `/api/telemetry/:sensorId` | **JWT** (`JWT_SECRET`) | `Authorization: Bearer <JWT_TOKEN>` | Retrieves sensor-specific records |
| `GET` | `/api/health` | **None (Public)** | *None* | Uptime and container diagnostics |
| `GET` | `/` | **None (Public)** | *None* | Backend status probe |

---

## ⚙️ Environment Configuration

Environment variables are loaded from the root `.env` file via `dotenv`.

1. Copy `.env.example` to `.env` in the root directory (if not already created):
   ```bash
   cp .env.example .env
   ```
2. Configure both `API_TOKEN` and `JWT_SECRET` in `.env`:
   ```env
   # API Token Config (Ingestion)
   API_TOKEN=your_secure_api_token_here

   # JWT Authentication Config (Member 2 - IOT-NFR-021)
   JWT_SECRET=your_secure_random_jwt_secret_key_here
   ```
   > **Note:** Never commit `.env` or hardcode secrets into the source repository. The `.env` file is excluded in `.gitignore`.

---

## 🔑 Generating a Development Token

To generate a cryptographically valid JWT for local development and API testing:

```bash
# From the backend directory:
npm run generate-token

# Or execute directly with custom options:
node scripts/generateToken.js --sub "developer-01" --role "admin" --expiresIn "12h"
```

> **Production Token Issuance Notice:**  
> In production, token issuance must be handled by a dedicated, trusted identity provider (IdP) or authentication service (e.g., OAuth 2.0 / OpenID Connect, Keycloak, Auth0). Development scripts are strictly for authorized local testing and integration workflows.

---

## 📡 Making Authenticated Requests

### 1. Ingesting Telemetry (API Token Required)
```bash
curl -X POST http://localhost:3000/api/telemetry \
  -H "Authorization: Bearer <YOUR_API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"sensorId": "SENSOR-01", "temperature": 23.5, "humidity": 60}'
```

### 2. Querying Telemetry (JWT Required)
```bash
# Retrieve all telemetry
curl -H "Authorization: Bearer <YOUR_JWT_TOKEN>" http://localhost:3000/api/telemetry

# Retrieve telemetry for a specific sensor
curl -H "Authorization: Bearer <YOUR_JWT_TOKEN>" http://localhost:3000/api/telemetry/SENSOR-01
```

### 3. Service Diagnostics (Public)
```bash
curl http://localhost:3000/api/health
```

---

## 🧪 Running Automated Tests

Run the test suite using Jest:

```bash
cd backend
npm test
```

### Test Coverage includes:
- **Telemetry Ingestion & Validation:** Valid ingestion (`TC-INGEST-01`), temperature limits (`TC-INGEST-02`), field validation (`TC-VAL-01` to `TC-VAL-05`).
- **Telemetry Data Retrieval:** All records query (`TC-API-01`), sensor query (`TC-API-02`), unknown sensor handling (`TC-API-03`).
- **Real-Time WebSocket Integration:** Live telemetry broadcasting (`TC-WS-01`), client disconnect stability (`TC-WS-02`).
- **Diagnostics:** Health check and uptime diagnostics (`TC-HEALTH-01`).
- **API Token & Rate Limiting:** Missing API token rejection (`TC-SEC-01`), invalid API token rejection (`TC-SEC-02`), rate limiting threshold enforcement (`TC-SEC-03`).
- **JWT Authentication Suite (IOT-NFR-021):**
  - `TC-JWT-01`: Valid token grants access to `GET /api/telemetry`.
  - `TC-JWT-02`: Valid token grants access to `GET /api/telemetry/:sensorId`.
  - `TC-JWT-03`: Missing token returns HTTP 401.
  - `TC-JWT-04`: Invalid token signature returns HTTP 401.
  - `TC-JWT-05`: Expired token returns HTTP 401.
  - `TC-JWT-06`: Malformed Bearer header returns HTTP 401.
  - `TC-JWT-07`: Missing `JWT_SECRET` returns HTTP 503.
  - `TC-JWT-08`: `POST /api/telemetry` does not require JWT (uses API token).
  - `TC-JWT-09`: `GET /api/health` remains public without credentials.
  - `TC-JWT-10`: Disallowed signing algorithms (e.g. `none`) are rejected.
