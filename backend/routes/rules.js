const express = require("express");
const router = express.Router();

const {
    listRules,
    getRule,
    createRule,
    updateRule,
    setRuleStatus,
    deleteRule,
    getAlerts
} = require("../controllers/ruleController");

const { authenticateJWT } = require("../middleware/jwtAuth");
const { requireRole, requireAdmin } = require("../middleware/roleAuth");

// Require JWT for all rules endpoints (IOT-NFR-021)
router.use(authenticateJWT);

// GET /api/rules/alerts — Query recent rule breach alerts (Admin and Viewer)
router.get("/alerts", requireRole("admin", "viewer"), getAlerts);

// GET /api/rules — List all dynamic rules (Admin and Viewer)
router.get("/", requireRole("admin", "viewer"), listRules);

// GET /api/rules/:id — Get rule by ID (Admin and Viewer)
router.get("/:id", requireRole("admin", "viewer"), getRule);

// POST /api/rules — Create new rule (Admin only)
router.post("/", requireAdmin, createRule);

// PUT /api/rules/:id — Update existing rule (Admin only)
router.put("/:id", requireAdmin, updateRule);

// PATCH /api/rules/:id/status — Enable or disable rule (Admin only)
router.patch("/:id/status", requireAdmin, setRuleStatus);

// DELETE /api/rules/:id — Delete rule (Admin only)
router.delete("/:id", requireAdmin, deleteRule);

module.exports = router;
