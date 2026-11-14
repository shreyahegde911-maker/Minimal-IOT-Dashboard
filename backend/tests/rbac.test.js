const request = require("supertest");
const jwt = require("jsonwebtoken");
const { app, server } = require("../server");
const { closeSocket } = require("../websocket/socket");
const ruleEngine = require("../services/ruleEngineService");

const TEST_JWT_SECRET = "ci-test-jwt-secret-for-rbac-tests";

let originalJwtSecret;

function generateToken(role = "admin", expiresIn = "1h") {
    return jwt.sign(
        {
            sub: "user-test",
            role: role,
            iss: "miniot-auth-test"
        },
        TEST_JWT_SECRET,
        {
            algorithm: "HS256",
            expiresIn
        }
    );
}

beforeAll((done) => {
    originalJwtSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    done();
});

afterAll(async () => {
    process.env.JWT_SECRET = originalJwtSecret;
    await new Promise((resolve) => closeSocket(resolve));
});

beforeEach(() => {
    ruleEngine.resetState();
});

describe("Role-Based Access Control (RBAC) & Authentication Tests (SAD §5)", () => {
    const adminToken = generateToken("admin");
    const viewerToken = generateToken("viewer");
    const invalidToken = "invalid.token.signature";
    const expiredToken = generateToken("admin", "-1s");

    describe("Authentication Enforcement (HTTP 401)", () => {
        test("should return 401 when Authorization header is missing on /api/rules", async () => {
            const res = await request(app).get("/api/rules");
            expect(res.statusCode).toBe(401);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/header is required/i);
        });

        test("should return 401 when invalid JWT token is supplied", async () => {
            const res = await request(app)
                .get("/api/rules")
                .set("Authorization", `Bearer ${invalidToken}`);

            expect(res.statusCode).toBe(401);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/Invalid or expired/i);
        });

        test("should return 401 when token is expired", async () => {
            const res = await request(app)
                .get("/api/rules")
                .set("Authorization", `Bearer ${expiredToken}`);

            expect(res.statusCode).toBe(401);
            expect(res.body.success).toBe(false);
        });
    });

    describe("Viewer Role Permissions (Read-Only: HTTP 200 vs 403)", () => {
        test("viewer CAN list dynamic rules (GET /api/rules -> 200)", async () => {
            const res = await request(app)
                .get("/api/rules")
                .set("Authorization", `Bearer ${viewerToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
        });

        test("viewer CAN view a specific rule (GET /api/rules/:id -> 200)", async () => {
            const res = await request(app)
                .get("/api/rules/rule-default-temp-high")
                .set("Authorization", `Bearer ${viewerToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe("rule-default-temp-high");
        });

        test("viewer CAN query rule alerts (GET /api/rules/alerts -> 200)", async () => {
            const res = await request(app)
                .get("/api/rules/alerts")
                .set("Authorization", `Bearer ${viewerToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
        });

        test("viewer CANNOT create a rule (POST /api/rules -> 403 Forbidden)", async () => {
            const res = await request(app)
                .post("/api/rules")
                .set("Authorization", `Bearer ${viewerToken}`)
                .send({
                    name: "Unauthorized Rule",
                    metric: "temperature",
                    operator: ">",
                    threshold: 50
                });

            expect(res.statusCode).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/Insufficient permissions/i);
        });

        test("viewer CANNOT update a rule (PUT /api/rules/:id -> 403 Forbidden)", async () => {
            const res = await request(app)
                .put("/api/rules/rule-default-temp-high")
                .set("Authorization", `Bearer ${viewerToken}`)
                .send({ threshold: 45.0 });

            expect(res.statusCode).toBe(403);
            expect(res.body.success).toBe(false);
        });

        test("viewer CANNOT enable/disable a rule (PATCH /api/rules/:id/status -> 403 Forbidden)", async () => {
            const res = await request(app)
                .patch("/api/rules/rule-default-temp-high/status")
                .set("Authorization", `Bearer ${viewerToken}`)
                .send({ enabled: false });

            expect(res.statusCode).toBe(403);
            expect(res.body.success).toBe(false);
        });

        test("viewer CANNOT delete a rule (DELETE /api/rules/:id -> 403 Forbidden)", async () => {
            const res = await request(app)
                .delete("/api/rules/rule-default-temp-high")
                .set("Authorization", `Bearer ${viewerToken}`);

            expect(res.statusCode).toBe(403);
            expect(res.body.success).toBe(false);
        });
    });

    describe("Admin Role Permissions (Full Management)", () => {
        test("admin CAN create a dynamic threshold rule (POST /api/rules -> 201)", async () => {
            const res = await request(app)
                .post("/api/rules")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                    name: "Admin Humidity Spike Rule",
                    metric: "humidity",
                    operator: ">=",
                    threshold: 85.0,
                    consecutiveCount: 2,
                    severity: "CRITICAL"
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBeDefined();
            expect(res.body.data.name).toBe("Admin Humidity Spike Rule");
        });

        test("admin CAN update a rule (PUT /api/rules/:id -> 200)", async () => {
            const targetRule = await ruleEngine.createRule({
                name: "Rule To Update",
                metric: "humidity",
                operator: ">",
                threshold: 75.0,
                consecutiveCount: 2
            });

            const res = await request(app)
                .put(`/api/rules/${targetRule.id}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                    threshold: 90.0,
                    consecutiveCount: 3
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.threshold).toBe(90.0);
            expect(res.body.data.consecutiveCount).toBe(3);
        });

        test("admin CAN toggle rule status (PATCH /api/rules/:id/status -> 200)", async () => {
            const targetRule = await ruleEngine.createRule({
                name: "Rule To Toggle",
                metric: "temperature",
                operator: ">",
                threshold: 30.0,
                enabled: true
            });

            const res = await request(app)
                .patch(`/api/rules/${targetRule.id}/status`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ enabled: false });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.enabled).toBe(false);
        });

        test("admin CAN delete a rule (DELETE /api/rules/:id -> 200)", async () => {
            const targetRule = await ruleEngine.createRule({
                name: "Rule To Delete",
                metric: "temperature",
                operator: ">",
                threshold: 50.0
            });

            const res = await request(app)
                .delete(`/api/rules/${targetRule.id}`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    describe("Unknown / Unauthorized Role Rejection", () => {
        test("should return 403 Forbidden for unknown user role", async () => {
            const guestToken = generateToken("guest");
            const res = await request(app)
                .get("/api/rules")
                .set("Authorization", `Bearer ${guestToken}`);

            expect(res.statusCode).toBe(403);
            expect(res.body.success).toBe(false);
        });
    });
});
