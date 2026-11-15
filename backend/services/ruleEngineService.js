const crypto = require("crypto");
const pool = require("../config/database");

/**
 * Dynamic Threshold Rules Engine Service (SAD §4.2)
 *
 * Supports:
 * - Metrics: 'temperature', 'humidity'
 * - Operators: '>', '>=', '<', '<=', '=='
 * - Configurable thresholds and consecutive-reading counts
 * - Sensor-specific or wildcard (all sensors) rules
 * - Consecutive breach detection with alert emitted ONLY on first threshold reach
 * - Counter reset when readings return to normal
 * - In-memory high-throughput evaluation with optional DB persistence
 */

class RuleEngineService {
    constructor() {
        this.rules = new Map();
        // State tracking: key = `${ruleId}:${sensorId}` -> current consecutive breach count
        this.consecutiveStates = new Map();
        // Ring buffer for recent alerts
        this.recentAlerts = [];
        this.maxAlertHistory = 100;
        this.dbInitialized = false;

        // Seed with a default rule conforming to SAD §4.2:
        // "Flag critical alert if temperature > 35°C for 3 consecutive readings"
        this.addRuleInMemory({
            id: "rule-default-temp-high",
            name: "High Temperature Critical",
            metric: "temperature",
            operator: ">",
            threshold: 35.0,
            consecutiveCount: 3,
            enabled: true,
            targetSensorId: null,
            severity: "CRITICAL",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        // Asynchronously initialize DB table and sync if database is reachable
        this.initDatabase().catch((err) => {
            console.warn("Dynamic rules database sync unavailable; operating in in-memory mode:", err.message);
        });
    }

    async initDatabase() {
        if (!pool) return;
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS rules (
                    id VARCHAR(64) PRIMARY KEY,
                    name VARCHAR(128) NOT NULL,
                    metric VARCHAR(32) NOT NULL,
                    operator VARCHAR(8) NOT NULL,
                    threshold DOUBLE PRECISION NOT NULL,
                    consecutive_count INTEGER NOT NULL DEFAULT 1,
                    enabled BOOLEAN NOT NULL DEFAULT TRUE,
                    target_sensor_id VARCHAR(64),
                    severity VARCHAR(20) DEFAULT 'CRITICAL',
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                );
            `);

            const result = await pool.query("SELECT * FROM rules");
            if (result.rows && result.rows.length > 0) {
                for (const row of result.rows) {
                    this.addRuleInMemory({
                        id: row.id,
                        name: row.name,
                        metric: row.metric,
                        operator: row.operator,
                        threshold: Number(row.threshold),
                        consecutiveCount: Number(row.consecutive_count),
                        enabled: Boolean(row.enabled),
                        targetSensorId: row.target_sensor_id,
                        severity: row.severity,
                        createdAt: new Date(row.created_at).toISOString(),
                        updatedAt: new Date(row.updated_at).toISOString()
                    });
                }
            } else {
                // Seed default rule into database
                const defRule = this.rules.get("rule-default-temp-high");
                if (defRule) {
                    await pool.query(
                        `INSERT INTO rules (id, name, metric, operator, threshold, consecutive_count, enabled, target_sensor_id, severity, created_at, updated_at)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                         ON CONFLICT (id) DO NOTHING`,
                        [
                            defRule.id,
                            defRule.name,
                            defRule.metric,
                            defRule.operator,
                            defRule.threshold,
                            defRule.consecutiveCount,
                            defRule.enabled,
                            defRule.targetSensorId,
                            defRule.severity,
                            defRule.createdAt,
                            defRule.updatedAt
                        ]
                    );
                }
            }
            this.dbInitialized = true;
        } catch (err) {
            // DB might be temporarily offline or non-existent in unit tests
            this.dbInitialized = false;
        }
    }

    addRuleInMemory(rule) {
        this.rules.set(rule.id, rule);
    }

    validateRulePayload(data, isUpdate = false) {
        const allowedMetrics = ["temperature", "humidity"];
        const allowedOperators = [">", ">=", "<", "<=", "=="];
        const allowedSeverities = ["CRITICAL", "WARNING", "INFO"];

        if (!isUpdate) {
            if (!data.name || typeof data.name !== "string" || !data.name.trim()) {
                return { valid: false, message: "Rule name is required and must be a non-empty string" };
            }
            if (!data.metric || !allowedMetrics.includes(data.metric)) {
                return { valid: false, message: `Metric must be one of: ${allowedMetrics.join(", ")}` };
            }
            if (!data.operator || !allowedOperators.includes(data.operator)) {
                return { valid: false, message: `Operator must be one of: ${allowedOperators.join(", ")}` };
            }
            if (data.threshold === undefined || typeof data.threshold !== "number" || !Number.isFinite(data.threshold)) {
                return { valid: false, message: "Threshold must be a valid number" };
            }
        } else {
            if (data.name !== undefined && (typeof data.name !== "string" || !data.name.trim())) {
                return { valid: false, message: "Rule name must be a non-empty string" };
            }
            if (data.metric !== undefined && !allowedMetrics.includes(data.metric)) {
                return { valid: false, message: `Metric must be one of: ${allowedMetrics.join(", ")}` };
            }
            if (data.operator !== undefined && !allowedOperators.includes(data.operator)) {
                return { valid: false, message: `Operator must be one of: ${allowedOperators.join(", ")}` };
            }
            if (data.threshold !== undefined && (typeof data.threshold !== "number" || !Number.isFinite(data.threshold))) {
                return { valid: false, message: "Threshold must be a valid number" };
            }
        }

        if (data.consecutiveCount !== undefined) {
            if (!Number.isInteger(data.consecutiveCount) || data.consecutiveCount < 1) {
                return { valid: false, message: "consecutiveCount must be an integer greater than or equal to 1" };
            }
        }

        if (data.severity !== undefined && !allowedSeverities.includes(data.severity)) {
            return { valid: false, message: `Severity must be one of: ${allowedSeverities.join(", ")}` };
        }

        if (data.enabled !== undefined && typeof data.enabled !== "boolean") {
            return { valid: false, message: "enabled must be a boolean" };
        }

        if (data.targetSensorId !== undefined && data.targetSensorId !== null && typeof data.targetSensorId !== "string") {
            return { valid: false, message: "targetSensorId must be a string or null" };
        }

        return { valid: true };
    }

    async createRule(data) {
        const validation = this.validateRulePayload(data, false);
        if (!validation.valid) {
            throw new Error(validation.message);
        }

        const id = data.id || `rule-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
        const newRule = {
            id,
            name: data.name.trim(),
            metric: data.metric,
            operator: data.operator,
            threshold: Number(data.threshold),
            consecutiveCount: data.consecutiveCount !== undefined ? Number(data.consecutiveCount) : 1,
            enabled: data.enabled !== undefined ? Boolean(data.enabled) : true,
            targetSensorId: data.targetSensorId ? data.targetSensorId.trim() : null,
            severity: data.severity || "CRITICAL",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.rules.set(id, newRule);

        if (pool && this.dbInitialized) {
            try {
                await pool.query(
                    `INSERT INTO rules (id, name, metric, operator, threshold, consecutive_count, enabled, target_sensor_id, severity, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                    [
                        newRule.id,
                        newRule.name,
                        newRule.metric,
                        newRule.operator,
                        newRule.threshold,
                        newRule.consecutiveCount,
                        newRule.enabled,
                        newRule.targetSensorId,
                        newRule.severity,
                        newRule.createdAt,
                        newRule.updatedAt
                    ]
                );
            } catch (err) {
                console.warn("Failed to persist created rule to PostgreSQL:", err.message);
            }
        }

        return newRule;
    }

    getRules() {
        return Array.from(this.rules.values());
    }

    getRuleById(id) {
        return this.rules.get(id) || null;
    }

    async updateRule(id, updates) {
        const existing = this.rules.get(id);
        if (!existing) return null;

        const validation = this.validateRulePayload(updates, true);
        if (!validation.valid) {
            throw new Error(validation.message);
        }

        const updatedRule = {
            ...existing,
            ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
            ...(updates.metric !== undefined ? { metric: updates.metric } : {}),
            ...(updates.operator !== undefined ? { operator: updates.operator } : {}),
            ...(updates.threshold !== undefined ? { threshold: Number(updates.threshold) } : {}),
            ...(updates.consecutiveCount !== undefined ? { consecutiveCount: Number(updates.consecutiveCount) } : {}),
            ...(updates.enabled !== undefined ? { enabled: Boolean(updates.enabled) } : {}),
            ...(updates.targetSensorId !== undefined ? { targetSensorId: updates.targetSensorId ? updates.targetSensorId.trim() : null } : {}),
            ...(updates.severity !== undefined ? { severity: updates.severity } : {}),
            updatedAt: new Date().toISOString()
        };

        this.rules.set(id, updatedRule);

        // Reset consecutive states associated with this rule to avoid stale breach triggers
        this.clearRuleStates(id);

        if (pool && this.dbInitialized) {
            try {
                await pool.query(
                    `UPDATE rules
                     SET name = $1, metric = $2, operator = $3, threshold = $4, consecutive_count = $5,
                         enabled = $6, target_sensor_id = $7, severity = $8, updated_at = $9
                     WHERE id = $10`,
                    [
                        updatedRule.name,
                        updatedRule.metric,
                        updatedRule.operator,
                        updatedRule.threshold,
                        updatedRule.consecutiveCount,
                        updatedRule.enabled,
                        updatedRule.targetSensorId,
                        updatedRule.severity,
                        updatedRule.updatedAt,
                        id
                    ]
                );
            } catch (err) {
                console.warn("Failed to persist updated rule to PostgreSQL:", err.message);
            }
        }

        return updatedRule;
    }

    async setRuleStatus(id, enabled) {
        if (typeof enabled !== "boolean") {
            throw new Error("enabled must be a boolean");
        }
        return this.updateRule(id, { enabled });
    }

    async deleteRule(id) {
        const existing = this.rules.get(id);
        if (!existing) return false;

        this.rules.delete(id);
        this.clearRuleStates(id);

        if (pool && this.dbInitialized) {
            try {
                await pool.query("DELETE FROM rules WHERE id = $1", [id]);
            } catch (err) {
                console.warn("Failed to delete rule from PostgreSQL:", err.message);
            }
        }

        return true;
    }

    clearRuleStates(ruleId) {
        for (const key of Array.from(this.consecutiveStates.keys())) {
            if (key.startsWith(`${ruleId}:`)) {
                this.consecutiveStates.delete(key);
            }
        }
    }

    isConditionSatisfied(value, operator, threshold) {
        switch (operator) {
            case ">":
                return value > threshold;
            case ">=":
                return value >= threshold;
            case "<":
                return value < threshold;
            case "<=":
                return value <= threshold;
            case "==":
                return value === threshold;
            default:
                return false;
        }
    }

    /**
     * Evaluates incoming telemetry against all active rules.
     *
     * Rule logic:
     * - Only active (enabled) rules are evaluated.
     * - Compares metric (temperature or humidity) against rule.threshold using rule.operator.
     * - Increments consecutive count on breach; resets count to 0 when reading does not satisfy condition.
     * - Triggers an alert ONLY when consecutive breach count FIRST reaches rule.consecutiveCount.
     * - Does NOT repeatedly emit alerts for every subsequent violating reading in the same continuous breach.
     *
     * @param {Object} telemetry - { sensorId, temperature, humidity, timestamp }
     * @returns {Array} triggeredAlerts - Array of newly triggered alert objects
     */
    evaluateTelemetry(telemetry) {
        if (!telemetry || !telemetry.sensorId) {
            return [];
        }

        const sensorId = telemetry.sensorId;
        const triggeredAlerts = [];

        for (const rule of this.rules.values()) {
            if (!rule.enabled) {
                continue;
            }

            // Check if rule targets a specific sensor
            if (rule.targetSensorId && rule.targetSensorId !== sensorId) {
                continue;
            }

            // Extract metric value
            let metricValue = null;
            if (rule.metric === "temperature" && typeof telemetry.temperature === "number") {
                metricValue = telemetry.temperature;
            } else if (rule.metric === "humidity" && typeof telemetry.humidity === "number") {
                metricValue = telemetry.humidity;
            }

            if (metricValue === null || !Number.isFinite(metricValue)) {
                continue;
            }

            const stateKey = `${rule.id}:${sensorId}`;
            const currentCount = this.consecutiveStates.get(stateKey) || 0;
            const breached = this.isConditionSatisfied(metricValue, rule.operator, rule.threshold);

            if (breached) {
                const newCount = currentCount + 1;
                this.consecutiveStates.set(stateKey, newCount);

                // IMPORTANT: Trigger alert ONLY when the consecutive-reading count
                // first reaches the configured threshold (e.g. newCount === rule.consecutiveCount).
                // Do not repeatedly emit for newCount > rule.consecutiveCount.
                if (newCount === rule.consecutiveCount) {
                    const alert = {
                        id: `alert-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
                        ruleId: rule.id,
                        ruleName: rule.name,
                        sensorId,
                        metric: rule.metric,
                        value: metricValue,
                        operator: rule.operator,
                        threshold: rule.threshold,
                        consecutiveCount: rule.consecutiveCount,
                        currentConsecutive: newCount,
                        severity: rule.severity,
                        timestamp: telemetry.timestamp || new Date().toISOString(),
                        message: `Rule '${rule.name}' triggered on ${sensorId}: ${rule.metric} ${rule.operator} ${rule.threshold} (actual: ${metricValue}) for ${rule.consecutiveCount} consecutive reading(s)`
                    };

                    triggeredAlerts.push(alert);
                    this.recordAlert(alert);
                }
            } else {
                // When reading no longer satisfies the condition, reset consecutive count to 0
                if (currentCount > 0) {
                    this.consecutiveStates.set(stateKey, 0);
                }
            }
        }

        return triggeredAlerts;
    }

    recordAlert(alert) {
        this.recentAlerts.unshift(alert);
        if (this.recentAlerts.length > this.maxAlertHistory) {
            this.recentAlerts.pop();
        }
    }

    getAlerts(filters = {}) {
        let alerts = this.recentAlerts;
        if (filters.sensorId) {
            alerts = alerts.filter((a) => a.sensorId === filters.sensorId);
        }
        if (filters.ruleId) {
            alerts = alerts.filter((a) => a.ruleId === filters.ruleId);
        }
        if (filters.limit && Number.isInteger(Number(filters.limit))) {
            alerts = alerts.slice(0, Number(filters.limit));
        }
        return alerts;
    }

    // Reset all rules and states (useful for automated testing)
    resetState() {
        this.rules.clear();
        this.consecutiveStates.clear();
        this.recentAlerts = [];
        this.addRuleInMemory({
            id: "rule-default-temp-high",
            name: "High Temperature Critical",
            metric: "temperature",
            operator: ">",
            threshold: 35.0,
            consecutiveCount: 3,
            enabled: true,
            targetSensorId: null,
            severity: "CRITICAL",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    }
}

// Singleton instance
const ruleEngine = new RuleEngineService();

module.exports = ruleEngine;
