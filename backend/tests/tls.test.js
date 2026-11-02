const request = require("supertest");
const { app, server } = require("../server");
const pool = require("../config/database");

const API_TOKEN = process.env.API_TOKEN || "ci-test-token-for-github-actions";

describe("TLS Communication Security Tests (IOT-NFR-020)", () => {
    let originalEnforceHttps;

    beforeAll(() => {
        originalEnforceHttps = process.env.ENFORCE_HTTPS;
    });

    afterAll(async () => {
        process.env.ENFORCE_HTTPS = originalEnforceHttps;
        await new Promise((resolve) => server.close(resolve));
        await pool.end();
    });

    // TC-TLS-01: Express recognizes secure HTTPS requests forwarded from a trusted reverse proxy
    test("TC-TLS-01: should recognize secure HTTPS requests when X-Forwarded-Proto is https", async () => {
        const response = await request(app)
            .get("/api/health")
            .set("X-Forwarded-Proto", "https");

        expect(response.statusCode).toBe(200);
        expect(response.body.status).toBe("healthy");
        expect(response.body.security.secure).toBe(true);
        expect(response.body.security.protocol).toBe("https");
        expect(response.body.security.tls).toBe("TLS 1.2+ active");
    });

    // TC-TLS-02: Emits Strict-Transport-Security (HSTS) on secure connections
    test("TC-TLS-02: should attach Strict-Transport-Security (HSTS) header on secure requests", async () => {
        const response = await request(app)
            .get("/api/health")
            .set("X-Forwarded-Proto", "https");

        expect(response.statusCode).toBe(200);
        expect(response.headers["strict-transport-security"]).toBeDefined();
        expect(response.headers["strict-transport-security"]).toContain("max-age=31536000");
        expect(response.headers["strict-transport-security"]).toContain("includeSubDomains");
    });

    // TC-TLS-03: Does not attach HSTS on plain HTTP requests
    test("TC-TLS-03: should not attach HSTS header on insecure HTTP requests", async () => {
        const response = await request(app)
            .get("/api/health");

        expect(response.statusCode).toBe(200);
        expect(response.headers["strict-transport-security"]).toBeUndefined();
        expect(response.body.security.secure).toBe(false);
        expect(response.body.security.protocol).toBe("http");
    });

    // TC-TLS-04: Emits standard security headers on all responses
    test("TC-TLS-04: should include defense-in-depth security headers (X-Content-Type-Options, X-Frame-Options)", async () => {
        const response = await request(app)
            .get("/api/health");

        expect(response.statusCode).toBe(200);
        expect(response.headers["x-content-type-options"]).toBe("nosniff");
        expect(response.headers["x-frame-options"]).toBe("DENY");
    });

    // TC-TLS-05: API Ingestion works over secure HTTPS connections with valid API token
    test("TC-TLS-05: should accept telemetry over secure HTTPS with valid API token", async () => {
        const response = await request(app)
            .post("/api/telemetry")
            .set("X-Forwarded-Proto", "https")
            .set("Authorization", `Bearer ${API_TOKEN}`)
            .send({
                sensorId: "TLS-TEST-001",
                temperature: 23.5,
                humidity: 50.0
            });

        expect(response.statusCode).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.headers["strict-transport-security"]).toBeDefined();
    });

    // TC-TLS-06: API Ingestion over secure HTTPS still enforces authentication
    test("TC-TLS-06: should reject unauthenticated telemetry even over secure HTTPS", async () => {
        const response = await request(app)
            .post("/api/telemetry")
            .set("X-Forwarded-Proto", "https")
            .send({
                sensorId: "TLS-TEST-002",
                temperature: 23.5,
                humidity: 50.0
            });

        expect(response.statusCode).toBe(401);
        expect(response.body.success).toBe(false);
    });

    // TC-TLS-07: HTTPS enforcement redirects GET requests and avoids loops when secure
    test("TC-TLS-07: should redirect insecure GET requests when ENFORCE_HTTPS is true", async () => {
        process.env.ENFORCE_HTTPS = "true";
        try {
            // Insecure request without X-Forwarded-Proto: https
            const resInsecure = await request(app)
                .get("/api/health")
                .set("Host", "dashboard.example.com");

            expect(resInsecure.statusCode).toBe(301);
            expect(resInsecure.headers.location).toBe("https://dashboard.example.com/api/health");

            // Secure request behind trusted proxy (no redirect loop!)
            const resSecure = await request(app)
                .get("/api/health")
                .set("X-Forwarded-Proto", "https")
                .set("Host", "dashboard.example.com");

            expect(resSecure.statusCode).toBe(200);
            expect(resSecure.body.status).toBe("healthy");
        } finally {
            process.env.ENFORCE_HTTPS = "false";
        }
    });

    // TC-TLS-08: Insecure mutation requests are blocked when ENFORCE_HTTPS is active
    test("TC-TLS-08: should reject insecure mutation requests when ENFORCE_HTTPS is true", async () => {
        process.env.ENFORCE_HTTPS = "true";
        try {
            const response = await request(app)
                .post("/api/telemetry")
                .set("Authorization", `Bearer ${API_TOKEN}`)
                .send({
                    sensorId: "INSECURE-TEST",
                    temperature: 20.0,
                    humidity: 40.0
                });

            expect(response.statusCode).toBe(403);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain("HTTPS is required");
        } finally {
            process.env.ENFORCE_HTTPS = "false";
        }
    });

    // TC-TLS-09: Sensitive certificate or private key contents are not exposed by endpoints
    test("TC-TLS-09: should verify that no private key material is exposed through responses", async () => {
        const response = await request(app).get("/api/health");

        const bodyString = JSON.stringify(response.body);
        expect(bodyString).not.toContain("BEGIN PRIVATE KEY");
        expect(bodyString).not.toContain("BEGIN RSA PRIVATE KEY");
        expect(bodyString).not.toContain("BEGIN CERTIFICATE");
    });
});

