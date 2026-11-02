# Minimal IoT Dashboard — Backend Documentation

The backend service is built using **Node.js** and **Express.js**, responsible for sensor telemetry ingestion, PostgreSQL/TimescaleDB persistence, real-time WebSocket broadcasting via **Socket.IO**, and protected REST APIs.

---

## 🔐 JWT Authentication (IOT-NFR-021)

### Overview
In accordance with **IOT-NFR-021 (Authentication)**, sensitive endpoints require JSON Web Token (JWT) authentication. The verification middleware (`backend/middleware/jwtAuth.js`):
- Verifies JWT signatures using the HMAC-SHA256 (`HS256`) algorithm.
- Enforces strict algorithm restriction (`algorithms: ["HS256"]`) to prevent algorithm-confusion and signature-bypass attacks.
- Enforces the standard HTTP `Authorization: Bearer <token>` header format.
- Rejects missing, malformed, expired, or invalid tokens with HTTP `401 Unauthorized`.
- Returns HTTP `503 Service Unavailable` if the authentication service is not configured (i.e. `JWT_SECRET` is unset).
- Decodes and attaches verified token claims to `req.user` for downstream route handlers.

### Protected vs. Public Endpoints

| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/telemetry` | **Public** | Headless sensor data ingestion pipeline (preserves ingestion functionality) |
| `GET` | `/api/telemetry` | **Protected (JWT)** | Retrieves all stored telemetry records |
| `GET` | `/api/telemetry/:sensorId` | **Protected (JWT)** | Retrieves telemetry records for a specific sensor |
| `GET` | `/api/health` | **Public** | Container health checks and uptime diagnostics |
| `GET` | `/` | **Public** | Backend service root status message |

> **Architectural Decision (SRS Traceability):**  
> Per **IOT-NFR-021**, *"Sensitive management endpoints shall require JWT authentication"*. Currently, the project does not have dedicated administrative management endpoints (e.g. device registration, user account management, or system configuration). Protecting telemetry data retrieval queries (`GET /api/telemetry*`) ensures that sensor history and telemetry data streams cannot be harvested by unauthorized clients, while leaving ingestion open for simulated or physical edge nodes. The `authenticateJWT` middleware is built as a reusable Express middleware, ready to protect future administrative endpoints as they are developed.

---

## ⚙️ Environment Configuration

Environment variables are loaded from the root `.env` file via `dotenv`.

1. Copy `.env.example` to `.env` in the root directory (if not already created):
   ```bash
   cp .env.example .env
   ```
2. Configure `JWT_SECRET` in `.env` with a cryptographically secure random string:
   ```env
   # JWT Authentication Config (Member 2 - IOT-NFR-021)
   JWT_SECRET=your_secure_random_jwt_secret_key_here
   ```
   > **Note:** Never commit `.env` or hardcode secrets into the source repository. The `.env` file is excluded in `.gitignore`.

---

## 🔑 Generating a Development Token

The project currently does not have a dedicated user login or registration endpoint. To generate a cryptographically valid token for local development and API testing without exposing insecure public token-generation APIs:

Run the local Node.js token generation utility:
```bash
# From the backend directory:
npm run generate-token

# Or execute directly:
node scripts/generateToken.js
```

You can customize the subject, role, and expiration:
```bash
node scripts/generateToken.js --sub "developer-01" --role "admin" --expiresIn "12h"
```

> **Production Token Issuance Notice:**  
> In a production environment, token issuance must be handled by a dedicated, trusted identity provider (IdP) or authentication service (e.g., OAuth 2.0 / OpenID Connect, Keycloak, Auth0, or an enterprise identity directory). Development scripts are strictly for authorized local testing and integration workflows.

---

## 📡 Making Authenticated Requests

Include the token in the `Authorization` header formatted as a Bearer token:

### Example: Using cURL
```bash
# 1. Retrieve all telemetry (Protected)
curl -H "Authorization: Bearer <YOUR_TOKEN>" http://localhost:3000/api/telemetry

# 2. Retrieve telemetry for a specific sensor (Protected)
curl -H "Authorization: Bearer <YOUR_TOKEN>" http://localhost:3000/api/telemetry/TEST-001

# 3. Post telemetry (Public ingestion)
curl -X POST http://localhost:3000/api/telemetry \
  -H "Content-Type: application/json" \
  -d '{"sensorId": "SENSOR-01", "temperature": 23.5, "humidity": 60}'

# 4. Check service health (Public)
curl http://localhost:3000/api/health
```

### Example: Using JavaScript / Fetch
```javascript
const response = await fetch("http://localhost:3000/api/telemetry", {
  method: "GET",
  headers: {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  }
});

const result = await response.json();
console.log(result);
```

---

## 🧪 Running Automated Tests

Run the test suite using Jest:

```bash
cd backend
npm test
```

### Test Coverage includes:
- **Telemetry Ingestion Tests:** Valid payload acceptance (`TC-INGEST-01`), out-of-range rejection (`TC-INGEST-02`), schema validation (`TC-VAL-01` to `TC-VAL-05`).
- **Telemetry API Retrieval Tests:** All records retrieval (`TC-API-01`), sensor-specific retrieval (`TC-API-02`), unknown sensor handling (`TC-API-03`).
- **WebSocket Tests:** Real-time broadcast verification (`TC-WS-01`), client disconnect stability (`TC-WS-02`).
- **Health Diagnostics:** Health check status and uptime reporting (`TC-HEALTH-01`).
- **JWT Authentication Tests (IOT-NFR-021):**
  - `TC-JWT-01`: Valid token grants access to `GET /api/telemetry`.
  - `TC-JWT-02`: Valid token grants access to `GET /api/telemetry/:sensorId`.
  - `TC-JWT-03`: Missing token returns HTTP 401.
  - `TC-JWT-04`: Invalid token signature returns HTTP 401.
  - `TC-JWT-05`: Expired token returns HTTP 401.
  - `TC-JWT-06`: Malformed Bearer header returns HTTP 401.
  - `TC-JWT-07`: Missing `JWT_SECRET` returns HTTP 503.
  - `TC-JWT-08`: `POST /api/telemetry` remains public and accessible without JWT.
  - `TC-JWT-09`: `GET /api/health` remains public and accessible without JWT.
  - `TC-JWT-10`: Disallowed signing algorithms (e.g. `none`) are rejected.
