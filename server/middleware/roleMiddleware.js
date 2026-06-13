const roleMiddleware = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.roles) {
      return res.status(403).json({
        success: false,
        message: `User is not authorized to access this route`,
      });
    }

    const userRoleNames = req.user.roles.map(r => r.name);
    const hasRole = roles.some(role => userRoleNames.includes(role));

    if (!hasRole) {
      return res.status(403).json({
        success: false,
        message: `User with roles [${userRoleNames.join(', ')}] is not authorized to access this route`,
      });
    }

    next();
  };
};

module.exports = roleMiddleware;
