/**
 * Role-Based Access Control middleware factory.
 * Usage: authorize('admin', 'hr')  → allows admin and hr roles
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role(s): ${allowedRoles.join(', ')}.`,
      });
    }
    next();
  };
};

module.exports = { authorize };
