const express = require("express");
const request = require("supertest");
const { apiTokenAuth } = require("../middleware/apiTokenAuth");

describe("Sensor API Key Authentication Middleware Tests (SAD §5 STRIDE)", () => {
    const TEST_TOKEN = "test-sensor-api-key-secret-12345";
    let app;
    let originalToken;

    beforeAll(() => {
        originalToken = process.env.API_TOKEN;
        process.env.API_TOKEN = TEST_TOKEN;

        app = express();
        app.use(express.json());
        // Protected test ingestion endpoint
        app.post("/api/test-ingest", apiTokenAuth, (req, res) => {
            res.status(200).json({ success: true, message: "Authorized" });
        });
    });

    afterAll(() => {
        process.env.API_TOKEN = originalToken;
    });

    describe("Documented X-Sensor-API-Key Header", () => {
        test("should accept request with valid X-Sensor-API-Key header", async () => {
            const res = await request(app)
                .post("/api/test-ingest")
                .set("X-Sensor-API-Key", TEST_TOKEN)
                .send({ sensorId: "sensor-01", temperature: 22.0, humidity: 45.0 });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
        });

        test("should reject request with invalid X-Sensor-API-Key header", async () => {
            const res = await request(app)
                .post("/api/test-ingest")
                .set("X-Sensor-API-Key", "wrong-key")
                .send({ sensorId: "sensor-01", temperature: 22.0, humidity: 45.0 });

            expect(res.statusCode).toBe(401);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/Invalid API token/i);
        });

        test("should reject request with empty X-Sensor-API-Key header", async () => {
            const res = await request(app)
                .post("/api/test-ingest")
                .set("X-Sensor-API-Key", "   ")
                .send({ sensorId: "sensor-01", temperature: 22.0, humidity: 45.0 });

            expect(res.statusCode).toBe(401);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/Invalid or missing/i);
        });
    });

    describe("Backward-Compatible Authorization: Bearer Header", () => {
        test("should accept request with valid Bearer token", async () => {
            const res = await request(app)
                .post("/api/test-ingest")
                .set("Authorization", `Bearer ${TEST_TOKEN}`)
                .send({ sensorId: "sensor-01", temperature: 22.0, humidity: 45.0 });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
        });

        test("should reject request with invalid Bearer token", async () => {
            const res = await request(app)
                .post("/api/test-ingest")
                .set("Authorization", "Bearer wrong-token")
                .send({ sensorId: "sensor-01", temperature: 22.0, humidity: 45.0 });

            expect(res.statusCode).toBe(401);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/Invalid API token/i);
        });

        test("should reject request with malformed Authorization header (not Bearer)", async () => {
            const res = await request(app)
                .post("/api/test-ingest")
                .set("Authorization", `Basic ${TEST_TOKEN}`)
                .send({ sensorId: "sensor-01" });

            expect(res.statusCode).toBe(401);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/Provide an API key via X-Sensor-API-Key header or Bearer token/i);
        });
    });

    describe("Missing Credentials & Server Misconfiguration", () => {
        test("should reject request missing both authentication headers", async () => {
            const res = await request(app)
                .post("/api/test-ingest")
                .send({ sensorId: "sensor-01" });

            expect(res.statusCode).toBe(401);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/Authentication required/i);
        });

        test("should return 503 if API_TOKEN is not configured on server", async () => {
            delete process.env.API_TOKEN;

            const res = await request(app)
                .post("/api/test-ingest")
                .set("X-Sensor-API-Key", TEST_TOKEN)
                .send({ sensorId: "sensor-01" });

            expect(res.statusCode).toBe(503);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/not configured/i);

            process.env.API_TOKEN = TEST_TOKEN;
        });
    });
});
