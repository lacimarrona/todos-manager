module.exports = function roles(...permitidos) {
  return (req, res, next) => {
    if (!req.user || !permitidos.includes(req.user.rol)) {
      return res.status(403).json({ success: false, message: 'Sin permisos para esta acción' });
    }
    next();
  };
};
