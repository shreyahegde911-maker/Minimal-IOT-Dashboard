const ruleEngine = require("../services/ruleEngineService");

describe("Dynamic Rules Engine Unit & Evaluation Tests (SAD §4.2)", () => {
    beforeEach(() => {
        ruleEngine.resetState();
    });

    describe("Rule CRUD Operations", () => {
        test("should have default high-temperature rule seeded", () => {
            const rules = ruleEngine.getRules();
            expect(rules.length).toBeGreaterThanOrEqual(1);
            const defaultRule = rules.find((r) => r.id === "rule-default-temp-high");
            expect(defaultRule).toBeDefined();
            expect(defaultRule.metric).toBe("temperature");
            expect(defaultRule.threshold).toBe(35.0);
            expect(defaultRule.consecutiveCount).toBe(3);
            expect(defaultRule.enabled).toBe(true);
        });

        test("should create a valid humidity threshold rule", async () => {
            const newRule = await ruleEngine.createRule({
                name: "High Humidity Alert",
                metric: "humidity",
                operator: ">",
                threshold: 80.0,
                consecutiveCount: 2,
                severity: "WARNING"
            });

            expect(newRule.id).toBeDefined();
            expect(newRule.name).toBe("High Humidity Alert");
            expect(newRule.metric).toBe("humidity");
            expect(newRule.threshold).toBe(80.0);
            expect(newRule.consecutiveCount).toBe(2);
            expect(newRule.enabled).toBe(true);

            const fetched = ruleEngine.getRuleById(newRule.id);
            expect(fetched).toEqual(newRule);
        });

        test("should reject rule creation with invalid metric", async () => {
            await expect(
                ruleEngine.createRule({
                    name: "Invalid Metric Rule",
                    metric: "pressure",
                    operator: ">",
                    threshold: 100
                })
            ).rejects.toThrow(/Metric must be one of/);
        });

        test("should reject rule creation with invalid operator", async () => {
            await expect(
                ruleEngine.createRule({
                    name: "Invalid Op Rule",
                    metric: "temperature",
                    operator: "~=",
                    threshold: 50
                })
            ).rejects.toThrow(/Operator must be one of/);
        });

        test("should reject rule creation with non-numeric threshold", async () => {
            await expect(
                ruleEngine.createRule({
                    name: "Bad Threshold Rule",
                    metric: "temperature",
                    operator: ">",
                    threshold: "warm"
                })
            ).rejects.toThrow(/Threshold must be a valid number/);
        });

        test("should reject consecutiveCount less than 1 or non-integer", async () => {
            await expect(
                ruleEngine.createRule({
                    name: "Bad Count",
                    metric: "temperature",
                    operator: ">",
                    threshold: 30,
                    consecutiveCount: 0
                })
            ).rejects.toThrow(/consecutiveCount must be an integer/);

            await expect(
                ruleEngine.createRule({
                    name: "Bad Count Float",
                    metric: "temperature",
                    operator: ">",
                    threshold: 30,
                    consecutiveCount: 1.5
                })
            ).rejects.toThrow(/consecutiveCount must be an integer/);
        });

        test("should update an existing rule's properties", async () => {
            const rule = await ruleEngine.createRule({
                name: "Original Name",
                metric: "temperature",
                operator: ">=",
                threshold: 40.0,
                consecutiveCount: 2
            });

            const updated = await ruleEngine.updateRule(rule.id, {
                name: "Updated Name",
                threshold: 42.5,
                consecutiveCount: 4
            });

            expect(updated.name).toBe("Updated Name");
            expect(updated.threshold).toBe(42.5);
            expect(updated.consecutiveCount).toBe(4);
            expect(updated.operator).toBe(">=");
        });

        test("should enable and disable rules", async () => {
            const rule = await ruleEngine.createRule({
                name: "Toggle Rule",
                metric: "humidity",
                operator: "<",
                threshold: 20,
                enabled: true
            });

            const disabled = await ruleEngine.setRuleStatus(rule.id, false);
            expect(disabled.enabled).toBe(false);

            const enabled = await ruleEngine.setRuleStatus(rule.id, true);
            expect(enabled.enabled).toBe(true);
        });

        test("should delete a rule", async () => {
            const rule = await ruleEngine.createRule({
                name: "Temporary Rule",
                metric: "temperature",
                operator: ">",
                threshold: 50
            });

            const deleted = await ruleEngine.deleteRule(rule.id);
            expect(deleted).toBe(true);

            const fetched = ruleEngine.getRuleById(rule.id);
            expect(fetched).toBeNull();
        });
    });

    describe("Consecutive-Reading Evaluation & Alert Dynamics", () => {
        test("should not emit alert before reaching configured consecutive count", async () => {
            // Default rule: temperature > 35°C for 3 consecutive readings
            const r1 = ruleEngine.evaluateTelemetry({
                sensorId: "sensor-01",
                temperature: 36.0,
                humidity: 50.0
            });
            expect(r1).toHaveLength(0);

            const r2 = ruleEngine.evaluateTelemetry({
                sensorId: "sensor-01",
                temperature: 37.0,
                humidity: 50.0
            });
            expect(r2).toHaveLength(0);
        });

        test("should trigger an alert ONLY when consecutive count first reaches threshold", async () => {
            // Reading 1: breach (count = 1)
            const r1 = ruleEngine.evaluateTelemetry({
                sensorId: "sensor-01",
                temperature: 36.0,
                humidity: 50.0
            });
            expect(r1).toHaveLength(0);

            // Reading 2: breach (count = 2)
            const r2 = ruleEngine.evaluateTelemetry({
                sensorId: "sensor-01",
                temperature: 37.0,
                humidity: 50.0
            });
            expect(r2).toHaveLength(0);

            // Reading 3: breach (count = 3 -> threshold reached!)
            const r3 = ruleEngine.evaluateTelemetry({
                sensorId: "sensor-01",
                temperature: 38.0,
                humidity: 50.0
            });
            expect(r3).toHaveLength(1);
            expect(r3[0].ruleName).toBe("High Temperature Critical");
            expect(r3[0].sensorId).toBe("sensor-01");
            expect(r3[0].value).toBe(38.0);
            expect(r3[0].consecutiveCount).toBe(3);
        });

        test("should NOT repeatedly emit alert for subsequent violating readings in same continuous breach", async () => {
            // First 3 breaching readings
            ruleEngine.evaluateTelemetry({ sensorId: "sensor-01", temperature: 36.0 });
            ruleEngine.evaluateTelemetry({ sensorId: "sensor-01", temperature: 37.0 });
            const r3 = ruleEngine.evaluateTelemetry({ sensorId: "sensor-01", temperature: 38.0 });
            expect(r3).toHaveLength(1);

            // Reading 4: still breaching (count = 4) -> must NOT re-emit alert
            const r4 = ruleEngine.evaluateTelemetry({ sensorId: "sensor-01", temperature: 39.0 });
            expect(r4).toHaveLength(0);

            // Reading 5: still breaching (count = 5) -> must NOT re-emit alert
            const r5 = ruleEngine.evaluateTelemetry({ sensorId: "sensor-01", temperature: 40.0 });
            expect(r5).toHaveLength(0);
        });

        test("should reset counter after a normal reading and re-trigger on new breach cycle", async () => {
            // Continuous breach reaching threshold
            ruleEngine.evaluateTelemetry({ sensorId: "sensor-01", temperature: 36.0 });
            ruleEngine.evaluateTelemetry({ sensorId: "sensor-01", temperature: 37.0 });
            const alert1 = ruleEngine.evaluateTelemetry({ sensorId: "sensor-01", temperature: 38.0 });
            expect(alert1).toHaveLength(1);

            // Reading returns to normal (24.0°C <= 35.0°C) -> resets counter to 0
            const normal = ruleEngine.evaluateTelemetry({ sensorId: "sensor-01", temperature: 24.0 });
            expect(normal).toHaveLength(0);

            // New breach cycle begins
            const n1 = ruleEngine.evaluateTelemetry({ sensorId: "sensor-01", temperature: 36.0 });
            expect(n1).toHaveLength(0);

            const n2 = ruleEngine.evaluateTelemetry({ sensorId: "sensor-01", temperature: 37.0 });
            expect(n2).toHaveLength(0);

            // Reaches threshold again -> triggers new alert
            const alert2 = ruleEngine.evaluateTelemetry({ sensorId: "sensor-01", temperature: 38.0 });
            expect(alert2).toHaveLength(1);
            expect(alert2[0].ruleName).toBe("High Temperature Critical");
        });

        test("should evaluate multiple sensors independently", async () => {
            // sensor-01 has 2 breaches; sensor-02 has 1 breach
            ruleEngine.evaluateTelemetry({ sensorId: "sensor-01", temperature: 36.0 });
            ruleEngine.evaluateTelemetry({ sensorId: "sensor-02", temperature: 36.0 });
            ruleEngine.evaluateTelemetry({ sensorId: "sensor-01", temperature: 37.0 });

            // sensor-02 receives normal reading; sensor-01 reaches 3rd breach
            ruleEngine.evaluateTelemetry({ sensorId: "sensor-02", temperature: 22.0 });
            const s1Alert = ruleEngine.evaluateTelemetry({ sensorId: "sensor-01", temperature: 38.0 });

            expect(s1Alert).toHaveLength(1);
            expect(s1Alert[0].sensorId).toBe("sensor-01");

            // sensor-02 should still require 3 consecutive readings
            const s2Reading = ruleEngine.evaluateTelemetry({ sensorId: "sensor-02", temperature: 39.0 });
            expect(s2Reading).toHaveLength(0);
        });

        test("should evaluate sensor-specific rules only for the designated sensor", async () => {
            // Create rule targeting sensor-special only
            await ruleEngine.createRule({
                name: "Special Sensor Freeze",
                metric: "temperature",
                operator: "<",
                threshold: 0.0,
                consecutiveCount: 1,
                targetSensorId: "sensor-special"
            });

            // sensor-other breaches threshold but should not trigger target rule
            const otherAlerts = ruleEngine.evaluateTelemetry({
                sensorId: "sensor-other",
                temperature: -5.0
            });
            const specialRuleAlert = otherAlerts.find((a) => a.ruleName === "Special Sensor Freeze");
            expect(specialRuleAlert).toBeUndefined();

            // sensor-special triggers it immediately
            const targetAlerts = ruleEngine.evaluateTelemetry({
                sensorId: "sensor-special",
                temperature: -5.0
            });
            const targetedAlert = targetAlerts.find((a) => a.ruleName === "Special Sensor Freeze");
            expect(targetedAlert).toBeDefined();
            expect(targetedAlert.sensorId).toBe("sensor-special");
        });

        test("should ignore disabled rules during evaluation", async () => {
            const rule = await ruleEngine.createRule({
                name: "Ignored Rule",
                metric: "humidity",
                operator: ">",
                threshold: 90,
                consecutiveCount: 1,
                enabled: false
            });

            const alerts = ruleEngine.evaluateTelemetry({
                sensorId: "sensor-01",
                humidity: 95
            });

            const matched = alerts.find((a) => a.ruleId === rule.id);
            expect(matched).toBeUndefined();
        });

        test("should evaluate all comparison operators correctly (boundary conditions)", async () => {
            // >= operator
            const ruleGte = await ruleEngine.createRule({
                name: "GTE Boundary",
                metric: "temperature",
                operator: ">=",
                threshold: 30.0,
                consecutiveCount: 1
            });

            expect(ruleEngine.isConditionSatisfied(30.0, ruleGte.operator, ruleGte.threshold)).toBe(true);
            expect(ruleEngine.isConditionSatisfied(29.99, ruleGte.operator, ruleGte.threshold)).toBe(false);

            // <= operator
            const ruleLte = await ruleEngine.createRule({
                name: "LTE Boundary",
                metric: "humidity",
                operator: "<=",
                threshold: 20.0,
                consecutiveCount: 1
            });

            expect(ruleEngine.isConditionSatisfied(20.0, ruleLte.operator, ruleLte.threshold)).toBe(true);
            expect(ruleEngine.isConditionSatisfied(20.01, ruleLte.operator, ruleLte.threshold)).toBe(false);

            // == operator
            const ruleEq = await ruleEngine.createRule({
                name: "EQ Boundary",
                metric: "temperature",
                operator: "==",
                threshold: 25.0,
                consecutiveCount: 1
            });

            expect(ruleEngine.isConditionSatisfied(25.0, ruleEq.operator, ruleEq.threshold)).toBe(true);
            expect(ruleEngine.isConditionSatisfied(25.1, ruleEq.operator, ruleEq.threshold)).toBe(false);
        });
    });
});
