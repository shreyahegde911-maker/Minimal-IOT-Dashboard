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
The backend service is built using **Node.js** and **Express.js**, responsible for sensor telemetry ingestion, PostgreSQL/TimescaleDB persistence, real-time WebSocket broadcasting via **Socket.IO**, API rate limiting, and secure communication.

---

## 🔒 TLS Communication Security (IOT-NFR-020)

### 1. Requirement & Architecture Overview
In accordance with **IOT-NFR-020 (Encryption)**:
> *"All external API and WebSocket communications shall use TLS 1.2+ (HTTPS/WSS)."*

This requirement is shared between **Member 2 (Backend & Ingestion Engineer)** and **Member 4 (DevOps & Infrastructure Lead)**:

```
[ External Client / IoT Sensor / Browser ]
                   │
                   │ HTTPS / WSS (TLS 1.2+) - Port 443
                   ▼
┌────────────────────────────────────────────────────────┐
│               Nginx Reverse Proxy                      │
│            (Member 4 Infrastructure)                   │
│  - Edge TLS 1.2+ Termination                           │
│  - Port 80 -> 443 HTTPS Redirection                    │
│  - SSL Certificate & Key Mounts                        │
│  - Sets X-Forwarded-Proto, X-Forwarded-For, Host       │
│  - WebSocket Upgrade Proxying (WSS)                    │
└──────────────────────────┬─────────────────────────────┘
                           │
                           │ HTTP / WS (Internal Docker Network)
                           ▼
┌────────────────────────────────────────────────────────┐
│                Express.js Backend                      │
│            (Member 2 Implementation)                   │
│  - Strict Proxy Trust ('loopback, linklocal,           │
│    uniquelocal')                                       │
│  - Evaluates req.secure & req.protocol via trusted IP  │
│  - Attaches Strict-Transport-Security (HSTS)           │
│  - Emits X-Content-Type-Options & X-Frame-Options      │
│  - Eliminates circular redirect loops                  │
│  - Provides TLS status in /api/health diagnostics      │
└────────────────────────────────────────────────────────┘
```

### 2. Component Division of Responsibilities

| Responsibility | Owner | Component | Status |
| :--- | :--- | :--- | :--- |
| **Edge TLS 1.2+ Termination** | Member 4 | `nginx/` reverse proxy | Reference provided in `nginx/conf.d/default.conf` |
| **Port 80 -> 443 Redirect** | Member 4 | `nginx/` reverse proxy | Configured at edge to prevent loops |
| **WSS WebSocket Upgrades** | Member 4 | `nginx/` reverse proxy | `proxy_set_header Upgrade $http_upgrade` |
| **Cert Provisioning & Renewal** | Member 4 | Docker / Let's Encrypt | Production PKI |
| **Trusted Proxy Configuration** | **Member 2** | `backend/server.js` | Configured via `trust proxy` |
| **Secure Request Recognition** | **Member 2** | `backend/server.js` | `req.secure` & `req.protocol === 'https'` |
| **HSTS & Security Headers** | **Member 2** | `backend/middleware/tlsSecurity.js` | `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options` |
| **Redirect Loop Prevention** | **Member 2** | `backend/middleware/tlsSecurity.js` | Evaluates verified `req.secure` |
| **TLS Diagnostic Verification** | **Member 2** | `backend/server.js` | `/api/health` security object |
| **Automated TLS Test Suite** | **Member 2** | `backend/tests/tls.test.js` | 9 automated unit/integration tests |
| **Git Key Protection** | **Member 2** | `.gitignore` | Ignores `*.key`, `*.pem`, `*.crt`, `certs/*` |

---

## ⚙️ Backend Integration Details

### Express Proxy Trust
To ensure Express correctly resolves client IPs and recognizes secure connections without enabling IP spoofing, `app.set("trust proxy", ...)` is restricted to trusted network topologies:
```javascript
const TRUST_PROXY = process.env.TRUST_PROXY || "loopback, linklocal, uniquelocal";
app.set("trust proxy", TRUST_PROXY);
```
- **Why avoid `true`?** Setting `trust proxy` to `true` blindly trusts all incoming headers from any client, allowing malicious actors to spoof client IPs (bypassing rate limiters) or forge `X-Forwarded-Proto`.
- **Why `loopback, linklocal, uniquelocal`?** This trusts local loopback and RFC 1918 / private container subnets (used by Docker bridge networks), enabling seamless reverse-proxying from Nginx.

### HSTS & Defense-in-Depth Headers
When a request is verified as secure (via `req.secure`), `backend/middleware/tlsSecurity.js` attaches:
```http
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
```

### Avoiding Redirect Loops
In reverse-proxy architectures where TLS terminates at Nginx and Nginx connects to Express over HTTP:
- Nginx performs the HTTP (80) -> HTTPS (443) redirect at the edge.
- Express verifies `req.secure` using the trusted `X-Forwarded-Proto` header.
- Optional application-level enforcement (`ENFORCE_HTTPS=true`) checks `req.secure` rather than raw socket state, eliminating infinite redirect loops.

---

## 🔑 Certificate Management

### Local Development Certificates
For local development and testing with Nginx:
1. Generate self-signed development certificates using the provided scripts:
   - **Linux / macOS / Git Bash:**
     ```bash
     bash scripts/generate-dev-certs.sh
     ```
   - **Windows PowerShell:**
     ```powershell
     .\scripts\generate-dev-certs.ps1
     ```
2. The certificates are stored in `certs/localhost.crt` and `certs/localhost.key`.
3. **Security Notice:** Local certificates and private keys are excluded from version control in `.gitignore`. Self-signed certificates must **never** be used in production.

### Production Certificate Management
In production deployments:
- Certificates must be issued by a trusted Certificate Authority (e.g., Let's Encrypt, DigiCert) or enterprise PKI.
- Certificates and private keys must be provisioned securely via container volume mounts or secrets managers (e.g., Docker Secrets, HashiCorp Vault, AWS Secrets Manager).
- Automatic renewal must be configured via Certbot or an ACME reverse proxy sidecar.
- Private keys (`.key`, `.pem`) must **never** be committed to Git.

---

## 📡 Testing Authenticated & Secure Endpoints

### Checking TLS Status via Health Endpoint
```bash
# Insecure direct check
curl http://localhost:3000/api/health

# Simulated trusted proxy HTTPS check
curl -H "X-Forwarded-Proto: https" http://localhost:3000/api/health
```

Example response:
```json
{
  "status": "healthy",
  "uptime": 12.34,
  "timestamp": "2026-11-02T19:30:00.000Z",
  "security": {
    "protocol": "https",
    "secure": true,
    "tls": "TLS 1.2+ active"
  }
}
```

### Ingesting Telemetry over HTTPS (with API Token)
```bash
curl -X POST https://localhost/api/telemetry \
  -H "Authorization: Bearer <API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"sensorId": "SENSOR-01", "temperature": 24.0, "humidity": 55.0}'
```

---

## 🧪 Running Automated Tests

Run the test suite using Jest:

Run the test suite with Jest:
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
### Automated TLS Test Coverage (`backend/tests/tls.test.js`):
- `TC-TLS-01`: Express recognizes secure HTTPS requests when `X-Forwarded-Proto: https` is forwarded from trusted proxy.
- `TC-TLS-02`: Attaches `Strict-Transport-Security` (HSTS) header on secure requests.
- `TC-TLS-03`: Does not attach HSTS on insecure HTTP requests.
- `TC-TLS-04`: Includes defense-in-depth security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`).
- `TC-TLS-05`: Telemetry ingestion operates correctly over secure HTTPS with valid API token.
- `TC-TLS-06`: Ingestion over secure HTTPS correctly enforces API token authentication.
- `TC-TLS-07`: `ENFORCE_HTTPS` redirects insecure GET requests without circular loops when secure.
- `TC-TLS-08`: `ENFORCE_HTTPS` blocks insecure mutation requests with HTTP 403.
- `TC-TLS-09`: Verifies that no private key or certificate content is exposed in responses.
