/**
 * Role-Based Access Control (RBAC) Middleware (SAD §5)
 * Enforces permissions for roles: 'admin', 'viewer', etc.
 */

function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const userRole = req.user.role;

        if (!userRole || !allowedRoles.includes(userRole)) {
            return res.status(403).json({
                success: false,
                message: "Forbidden: Insufficient permissions"
            });
        }

        next();
    };
}

module.exports = {
    requireRole,
    requireAdmin: requireRole("admin")
};
