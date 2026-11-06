const request = require("supertest");
const jwt = require("jsonwebtoken");
const { app, server } = require("../server");
const { io } = require("socket.io-client");
const { closeSocket } = require("../websocket/socket");
const { apiLimiter } = require("../middleware/rateLimiter");
const pool = require("../config/database");

const TEST_API_TOKEN = process.env.API_TOKEN || "ci-test-token-for-github-actions";
const TEST_JWT_SECRET = "ci-test-jwt-secret-for-authentication";

let originalJwtSecret;
let originalApiToken;
let serverAddress;

function generateTestToken(payload = { sub: "test-user", role: "admin" }, secret = TEST_JWT_SECRET, options = {}) {
    return jwt.sign(payload, secret, {
        algorithm: "HS256",
        expiresIn: "1h",
        ...options
    });
}

const apiTokenRequest = () => ({
    get: (url) => request(app).get(url)
        .set("Authorization", `Bearer ${TEST_API_TOKEN}`),

    post: (url) => request(app).post(url)
        .set("Authorization", `Bearer ${TEST_API_TOKEN}`)
});

beforeAll((done) => {
    originalJwtSecret = process.env.JWT_SECRET;
    originalApiToken = process.env.API_TOKEN;
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    process.env.API_TOKEN = TEST_API_TOKEN;

    server.listen(0, () => {
        serverAddress = `http://127.0.0.1:${server.address().port}`;
        done();
    });
});

afterEach(async () => {
    if (apiLimiter && typeof apiLimiter.resetKey === "function") {
        await apiLimiter.resetKey("127.0.0.1");
        await apiLimiter.resetKey("::ffff:127.0.0.1");
        await apiLimiter.resetKey("::1");
    }
});

afterAll(async () => {
    process.env.JWT_SECRET = originalJwtSecret;
    process.env.API_TOKEN = originalApiToken;

    await new Promise((resolve) => {
        closeSocket(resolve);
    });

    await new Promise((resolve) => {
        server.close(resolve);
    });

    await pool.end();
});

describe("Telemetry API Tests", () => {
    const validToken = generateTestToken();

    // TC-INGEST-01
    test("TC-INGEST-01: should accept valid telemetry data", async () => {

        const response = await apiTokenRequest()
            .post("/api/telemetry")
            .send({
                sensorId: "TEST-001",
                temperature: 24.5,
                humidity: 55
            });

        expect(response.statusCode).toBe(201);

        expect(response.body.success).toBe(true);

        expect(response.body.data.sensorId).toBe("TEST-001");
        expect(response.body.data.temperature).toBe(24.5);
        expect(response.body.data.humidity).toBe(55);

        expect(response.body.data.timestamp).toBeDefined();
    });

    // TC-INGEST-02
    test("TC-INGEST-02: should reject out-of-range temperature", async () => {

        const response = await apiTokenRequest()
            .post("/api/telemetry")
            .send({
                sensorId: "TEST-002",
                temperature: 150,
                humidity: 55
            });

        expect(response.statusCode).toBe(400);

        expect(response.body.success).toBe(false);

        expect(response.body.message)
            .toBe("temperature must be between -40 and 85");
    });
    
    
    // TC-VAL-01: Reject missing required fields
    test("TC-VAL-01: should reject telemetry with missing fields", async () => {
        const response = await apiTokenRequest()
            .post("/api/telemetry")
            .send({
                sensorId: "TEST-003",
                temperature: 24.5
            });

        expect(response.statusCode).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message)
            .toBe("sensorId, temperature and humidity are required");
    });

    // TC-VAL-02: Reject empty sensor ID
    test("TC-VAL-02: should reject an empty sensor ID", async () => {
        const response = await apiTokenRequest()
            .post("/api/telemetry")
            .send({
                sensorId: "   ",
                temperature: 24.5,
                humidity: 55
            });

        expect(response.statusCode).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message)
            .toBe("sensorId must be a non-empty string");
    });

    // TC-VAL-03: Reject non-numeric temperature
    test("TC-VAL-03: should reject non-numeric temperature", async () => {
        const response = await apiTokenRequest()
            .post("/api/telemetry")
            .send({
                sensorId: "TEST-004",
                temperature: "hot",
                humidity: 55
            });

        expect(response.statusCode).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message)
            .toBe("temperature must be a number");
    });

    // TC-VAL-04: Reject out-of-range humidity
    test("TC-VAL-04: should reject out-of-range humidity", async () => {
        const response = await apiTokenRequest()
            .post("/api/telemetry")
            .send({
                sensorId: "TEST-005",
                temperature: 24.5,
                humidity: 120
            });

        expect(response.statusCode).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message)
            .toBe("humidity must be between 0 and 100");
    });

    
    // TC-VAL-05: Invalid telemetry must not be stored
    test("TC-VAL-05: should not store invalid telemetry", async () => {
        const before = await request(app)
            .get("/api/telemetry")
            .set("Authorization", `Bearer ${validToken}`);

        await apiTokenRequest()
            .post("/api/telemetry")
            .send({
                sensorId: "INVALID-TEST",
                temperature: 150,
                humidity: 55
            })
            .expect(400);

        const after = await request(app)
            .get("/api/telemetry")
            .set("Authorization", `Bearer ${validToken}`);

        expect(after.body.count).toBe(before.body.count);
        expect(
            after.body.data.some(item => item.sensorId === "INVALID-TEST")
        ).toBe(false);
    });

    // TC-API-01: Get all telemetry
    test("TC-API-01: should return all telemetry records", async () => {
        const response = await request(app)
            .get("/api/telemetry")
            .set("Authorization", `Bearer ${validToken}`);

        expect(response.statusCode).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.count).toBeGreaterThanOrEqual(0);
        expect(Array.isArray(response.body.data)).toBe(true);
    });

    // TC-API-02: Get telemetry for a specific sensor
    test("TC-API-02: should return telemetry for the requested sensor", async () => {
        const sensorId = "API-TEST-SENSOR";

        await apiTokenRequest()
            .post("/api/telemetry")
            .send({
                sensorId,
                temperature: 25,
                humidity: 50
            })
            .expect(201);

        const response = await request(app)
            .get(`/api/telemetry/${sensorId}`)
            .set("Authorization", `Bearer ${validToken}`);

        expect(response.statusCode).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.sensorId).toBe(sensorId);
        expect(response.body.count).toBeGreaterThanOrEqual(1);

        expect(
            response.body.data.every(item => item.sensorId === sensorId)
        ).toBe(true);
    });

    // TC-API-03: Unknown sensor returns no records
    test("TC-API-03: should return an empty list for an unknown sensor", async () => {
        const response = await request(app)
            .get("/api/telemetry/UNKNOWN-SENSOR-999")
            .set("Authorization", `Bearer ${validToken}`);

        expect(response.statusCode).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.count).toBe(0);
        expect(response.body.data).toEqual([]);
    });

    // TC-WS-01
    test("TC-WS-01: should broadcast telemetry to connected WebSocket clients", async () => {

        const socket = io(serverAddress);

        const receivedTelemetry = new Promise((resolve, reject) => {

            const timeout = setTimeout(() => {
                reject(new Error("WebSocket telemetry was not received"));
            }, 3000);

            socket.on("telemetry", (data) => {
                clearTimeout(timeout);
                resolve(data);
            });
        });

        await new Promise((resolve, reject) => {
            socket.on("connect", resolve);
            socket.on("connect_error", reject);
        });

        await apiTokenRequest()
            .post("/api/telemetry")
            .send({
                sensorId: "TEST-WS-001",
                temperature: 26.5,
                humidity: 60
            })
            .expect(201);

        const data = await receivedTelemetry;

        expect(data.sensorId).toBe("TEST-WS-001");
        expect(data.temperature).toBe(26.5);
        expect(data.humidity).toBe(60);
        expect(data.timestamp).toBeDefined();

        socket.disconnect();
    });

    // TC-WS-02: Client disconnection should not crash the backend
    test("TC-WS-02: should handle client disconnection gracefully", async () => {
        const socket = io(serverAddress);

        await new Promise((resolve, reject) => {
            socket.once("connect", resolve);
            socket.once("connect_error", reject);
        });

        socket.disconnect();

        const response = await request(app)
            .get("/api/telemetry")
            .set("Authorization", `Bearer ${validToken}`);

        expect(response.statusCode).toBe(200);
        expect(response.body.success).toBe(true);
    });

    // TC-HEALTH-01: Health check endpoint returns status and uptime diagnostics
    test("TC-HEALTH-01: should return system health status and uptime", async () => {
        const response = await request(app).get("/api/health");

        expect(response.statusCode).toBe(200);
        expect(response.body.status).toBe("healthy");
        expect(typeof response.body.uptime).toBe("number");
        expect(response.body.uptime).toBeGreaterThanOrEqual(0);
        expect(response.body.timestamp).toBeDefined();
    });

    // TC-SEC-01: Reject requests without an API token
    test("TC-SEC-01: should reject requests without an API token", async () => {
        const response = await request(app)
            .post("/api/telemetry")
            .send({
                sensorId: "TEST-NO-TOKEN",
                temperature: 24.5,
                humidity: 55
            });

        expect(response.statusCode).toBe(401);
        expect(response.body.success).toBe(false);
    });

    // TC-SEC-02: Reject requests with an invalid API token
    test("TC-SEC-02: should reject requests with an invalid API token", async () => {
        const response = await request(app)
            .post("/api/telemetry")
            .set("Authorization", "Bearer invalid-token")
            .send({
                sensorId: "TEST-BAD-TOKEN",
                temperature: 24.5,
                humidity: 55
            });

        expect(response.statusCode).toBe(401);
        expect(response.body.success).toBe(false);
    });

    // TC-SEC-04: Reject telemetry ingestion without authentication
    test("TC-SEC-04: should reject POST requests without an API token", async () => {
        const response = await request(app)
            .post("/api/telemetry")
            .send({
                sensorId: "UNAUTH-001",
                temperature: 25,
                humidity: 50
            });

        expect(response.statusCode).toBe(401);
        expect(response.body.success).toBe(false);
    });

    // TC-SEC-05: Reject telemetry ingestion with an invalid token
    test("TC-SEC-05: should reject POST requests with an invalid API token", async () => {
        const response = await request(app)
            .post("/api/telemetry")
            .set("Authorization", "Bearer wrong-token")
            .send({
                sensorId: "UNAUTH-002",
                temperature: 25,
                humidity: 50
            });

        expect(response.statusCode).toBe(401);
        expect(response.body.success).toBe(false);
    });

    // TC-SEC-06: Reject malformed authorization headers
    test("TC-SEC-06: should reject malformed authorization headers", async () => {
        const response = await request(app)
            .get("/api/telemetry")
            .set("Authorization", "Basic invalid-token");

        expect(response.statusCode).toBe(401);
        expect(response.body.success).toBe(false);
    });

    // TC-SEC-03: Rate limiting
    test("TC-SEC-03: should reject requests after exceeding the rate limit", async () => {
        let response;

        for (let i = 0; i < 110; i++) {
            response = await request(app)
                .get("/api/telemetry")
                .set("Authorization", `Bearer ${validToken}`);

            if (response.statusCode === 429) {
                break;
            }
        }

        expect(response.statusCode).toBe(429);
        expect(response.body.success).toBe(false);
    }, 30000);
});

describe("JWT Authentication Tests (IOT-NFR-021)", () => {
    // 1. Valid JWT allows access to GET /api/telemetry
    test("TC-JWT-01: valid JWT allows access to GET /api/telemetry", async () => {
        const token = generateTestToken();
        const response = await request(app)
            .get("/api/telemetry")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(200);
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
    });

    // 2. Valid JWT allows access to GET /api/telemetry/:sensorId
    test("TC-JWT-02: valid JWT allows access to GET /api/telemetry/:sensorId", async () => {
        const token = generateTestToken();
        const response = await request(app)
            .get("/api/telemetry/TEST-001")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(200);
        expect(response.body.success).toBe(true);
    });

    // 3. Missing token returns 401
    test("TC-JWT-03: missing Authorization header returns 401", async () => {
        const response = await request(app)
            .get("/api/telemetry");

        expect(response.statusCode).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("Authorization header is required");
    });

    // 4. Invalid token returns 401
    test("TC-JWT-04: invalid token signature returns 401", async () => {
        const invalidToken = jwt.sign({ sub: "hacker" }, "wrong-secret-key", { algorithm: "HS256" });
        const response = await request(app)
            .get("/api/telemetry")
            .set("Authorization", `Bearer ${invalidToken}`);

        expect(response.statusCode).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("Invalid or expired access token");
    });

    // 5. Expired token returns 401
    test("TC-JWT-05: expired token returns 401", async () => {
        const expiredToken = jwt.sign(
            { sub: "expired-user" },
            TEST_JWT_SECRET,
            { algorithm: "HS256", expiresIn: "-1s" }
        );
        const response = await request(app)
            .get("/api/telemetry")
            .set("Authorization", `Bearer ${expiredToken}`);

        expect(response.statusCode).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("Invalid or expired access token");
    });

    // 6. Malformed Bearer header returns 401
    test("TC-JWT-06: malformed Bearer header returns 401", async () => {
        // Without Bearer prefix
        const res1 = await request(app)
            .get("/api/telemetry")
            .set("Authorization", "Basic somecredentials");
        expect(res1.statusCode).toBe(401);
        expect(res1.body.success).toBe(false);

        // Bearer prefix with empty token
        const res2 = await request(app)
            .get("/api/telemetry")
            .set("Authorization", "Bearer ");
        expect(res2.statusCode).toBe(401);
        expect(res2.body.success).toBe(false);

        // Bearer with extra parts
        const res3 = await request(app)
            .get("/api/telemetry")
            .set("Authorization", "Bearer part1 part2");
        expect(res3.statusCode).toBe(401);
        expect(res3.body.success).toBe(false);

        // Malformed token string
        const res4 = await request(app)
            .get("/api/telemetry")
            .set("Authorization", "Bearer not-a-valid-jwt-token");
        expect(res4.statusCode).toBe(401);
        expect(res4.body.success).toBe(false);
    });

    // 7. Missing JWT_SECRET returns 503
    test("TC-JWT-07: missing JWT_SECRET returns 503", async () => {
        const savedSecret = process.env.JWT_SECRET;
        try {
            delete process.env.JWT_SECRET;
            const token = generateTestToken();
            const response = await request(app)
                .get("/api/telemetry")
                .set("Authorization", `Bearer ${token}`);

            expect(response.statusCode).toBe(503);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe("Authentication service is not configured");
        } finally {
            process.env.JWT_SECRET = savedSecret;
        }
    });

    // 8. POST /api/telemetry remains accessible without JWT (uses API token)
    test("TC-JWT-08: POST /api/telemetry remains accessible without JWT (uses API token)", async () => {
        const response = await apiTokenRequest()
            .post("/api/telemetry")
            .send({
                sensorId: "TEST-NO-JWT",
                temperature: 22.0,
                humidity: 45.0
            });

        expect(response.statusCode).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.sensorId).toBe("TEST-NO-JWT");
    });

    // 9. GET /api/health remains accessible without JWT
    test("TC-JWT-09: GET /api/health remains accessible without JWT", async () => {
        const response = await request(app)
            .get("/api/health");

        expect(response.statusCode).toBe(200);
        expect(response.body.status).toBe("healthy");
    });

    // 10. Disallowed signing algorithm is rejected
    test("TC-JWT-10: reject tokens signed with disallowed algorithm (none)", async () => {
        const noneAlgToken = jwt.sign({ sub: "admin" }, "", { algorithm: "none" });
        const response = await request(app)
            .get("/api/telemetry")
            .set("Authorization", `Bearer ${noneAlgToken}`);

        expect(response.statusCode).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("Invalid or expired access token");
    });
    // 11. GET with API token but without JWT returns 401
    test("TC-JWT-11: GET with API token but without JWT returns 401", async () => {
        const response = await request(app)
            .get("/api/telemetry")
            .set("Authorization", "Bearer " + TEST_API_TOKEN);

        expect(response.statusCode).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("Invalid or expired access token");
    });

    // 12. GET for a specific sensor without JWT returns 401
    test("TC-JWT-12: GET for a specific sensor without JWT returns 401", async () => {
        const response = await request(app)
            .get("/api/telemetry/TEST-001");

        expect(response.statusCode).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("Authorization header is required");
    });
});
