const request = require("supertest");
const { app, server } = require("../server");
const { io } = require("socket.io-client");

let serverAddress;

beforeAll((done) => {
    server.listen(0, () => {
        serverAddress = `http://127.0.0.1:${server.address().port}`;
        done();
    });
});

afterAll((done) => {
    server.close(done);
});

describe("Telemetry API Tests", () => {

    // TC-INGEST-01
    test("TC-INGEST-01: should accept valid telemetry data", async () => {

        const response = await request(app)
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

        const response = await request(app)
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

        await request(app)
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

});