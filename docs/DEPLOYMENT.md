# Deployment and integration notes

## What this deployment stack changes

- Builds and serves the existing static frontend in its own Nginx container.
- Proxies `/api/` and `/socket.io/` to the backend over the private Compose network.
- Uses same-origin Socket.IO in the browser; it no longer assumes that the backend is running at `localhost:3000`.
- Keeps TimescaleDB off the host's public ports and stores its data in a named volume.
- Requires explicit database and ingestion secrets rather than hard-coding the database password in this production Compose file.
- Runs the existing simulator and analytics worker alongside the backend.

## Prerequisites

- Docker Desktop with Docker Compose v2.
- Existing project dependencies and files in the repository.
- A configured `.env` file with a strong `API_TOKEN` and `DB_PASSWORD`.

## Start on a development machine

From the repository root in PowerShell:

```powershell
Copy-Item .env.production.example .env
$token = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
$dbPassword = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
(Get-Content .env -Raw).Replace('replace_with_a_long_random_ingestion_token', $token).Replace('replace_with_a_long_random_database_password', $dbPassword) | Set-Content .env
docker compose -f docker-compose.production.yml config
docker compose -f docker-compose.production.yml up --build -d
docker compose -f docker-compose.production.yml ps
docker compose -f docker-compose.production.yml logs --tail 100 backend simulator analytics-alerting frontend
```

Open `http://localhost:8080`.

Do not run `docker compose down -v` on a database volume you need to preserve. To stop the stack while retaining data:

```powershell
docker compose -f docker-compose.production.yml down
```

## End-to-end checks

Check the dashboard HTTP response:

```powershell
Invoke-WebRequest http://localhost:8080/ -UseBasicParsing
```

Check backend health through the frontend reverse proxy:

```powershell
Invoke-RestMethod http://localhost:8080/api/health
```

The database is intentionally not published on a host port. To inspect counts, run:

```powershell
docker compose -f docker-compose.production.yml exec timescaledb psql -U postgres -d miniot -c "SELECT COUNT(*) AS total_readings, COUNT(DISTINCT device_id) AS devices, MAX(time) AS latest_reading FROM telemetry_logs;"
```

Inspect simulator and backend logs to confirm new readings are flowing:

```powershell
docker compose -f docker-compose.production.yml logs --tail 50 simulator backend
```

## Important security and deployment limitations

- The browser uses the Socket.IO stream for live telemetry. Do not treat this as user-authenticated private data; add authenticated Socket.IO access before publishing sensitive device data.
- The backend's existing API token protects telemetry API routes. Never embed the server-side `API_TOKEN` in JavaScript.
- The Compose file does not itself provision a public host, domain, firewall, managed secrets, backups, or HTTPS certificate. For a public deployment, run it on a server you control and put the frontend behind a properly configured TLS reverse proxy, or use a container host that provides HTTPS at its edge.
- Keep `.env` out of Git. Use the hosting provider's secret/environment-variable manager for a remote deployment.
- The database schema is initialized automatically only when PostgreSQL creates a fresh data directory. Existing volumes are not automatically migrated by the init script.
- Before calling a public deployment production-ready, verify backup/restore, resource limits, monitoring, alert delivery, TLS, and a full end-to-end smoke test on the actual host.
