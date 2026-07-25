const logger = require('../utils/logger');

const ROLES = {
  ADMIN:        'admin',
  VETERINARIAN: 'veterinarian',
  STAFF:        'staff',
  CLIENT:       'client',
};

const roleMiddleware = (...allowedRoles) => {
  const roles = allowedRoles.flat();

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Authentication required',
      });
    }

    if (!roles.includes(req.user.role)) {
      logger.auth('role.denied', {
        userId:   req.user.id,
        userRole: req.user.role,
        required: roles,
        path:     req.path,
      });
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Requires one of [' + roles.join(', ') + '] role',
      });
    }

    next();
  };
};

module.exports = { roleMiddleware, ROLES };
