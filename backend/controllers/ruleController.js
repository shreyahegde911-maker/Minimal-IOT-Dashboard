const ruleEngine = require("../services/ruleEngineService");

// List all dynamic threshold rules
async function listRules(req, res) {
    try {
        const rules = ruleEngine.getRules();
        return res.status(200).json({
            success: true,
            count: rules.length,
            data: rules
        });
    } catch (error) {
        console.error("Failed to list rules:", error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to list rules"
        });
    }
}

// Retrieve single rule by ID
async function getRule(req, res) {
    const { id } = req.params;
    const rule = ruleEngine.getRuleById(id);

    if (!rule) {
        return res.status(404).json({
            success: false,
            message: `Rule '${id}' not found`
        });
    }

    return res.status(200).json({
        success: true,
        data: rule
    });
}

// Create new dynamic rule
async function createRule(req, res) {
    try {
        const rule = await ruleEngine.createRule(req.body);
        return res.status(201).json({
            success: true,
            message: "Rule created successfully",
            data: rule
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
}

// Update existing dynamic rule
async function updateRule(req, res) {
    const { id } = req.params;
    try {
        const updated = await ruleEngine.updateRule(id, req.body);
        if (!updated) {
            return res.status(404).json({
                success: false,
                message: `Rule '${id}' not found`
            });
        }

        return res.status(200).json({
            success: true,
            message: "Rule updated successfully",
            data: updated
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
}

// Enable or disable a dynamic rule
async function setRuleStatus(req, res) {
    const { id } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== "boolean") {
        return res.status(400).json({
            success: false,
            message: "The 'enabled' field must be a boolean (true or false)"
        });
    }

    try {
        const updated = await ruleEngine.setRuleStatus(id, enabled);
        if (!updated) {
            return res.status(404).json({
                success: false,
                message: `Rule '${id}' not found`
            });
        }

        return res.status(200).json({
            success: true,
            message: `Rule '${id}' ${enabled ? "enabled" : "disabled"} successfully`,
            data: updated
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
}

// Delete dynamic rule
async function deleteRule(req, res) {
    const { id } = req.params;
    const deleted = await ruleEngine.deleteRule(id);

    if (!deleted) {
        return res.status(404).json({
            success: false,
            message: `Rule '${id}' not found`
        });
    }

    return res.status(200).json({
        success: true,
        message: `Rule '${id}' deleted successfully`
    });
}

// Retrieve recent rule evaluation alerts
async function getAlerts(req, res) {
    const { sensorId, ruleId, limit } = req.query;
    const alerts = ruleEngine.getAlerts({ sensorId, ruleId, limit });

    return res.status(200).json({
        success: true,
        count: alerts.length,
        data: alerts
    });
}

module.exports = {
    listRules,
    getRule,
    createRule,
    updateRule,
    setRuleStatus,
    deleteRule,
    getAlerts
};
