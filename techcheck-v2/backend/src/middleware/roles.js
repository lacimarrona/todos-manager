'use strict';

// Uso: roles('superadmin') o roles('admin', 'superadmin')
// Requiere que el middleware auth.js haya corrido primero
module.exports = (...rolesPermitidos) =>
  (req, res, next) => {
    if (!req.user || !rolesPermitidos.includes(req.user.rol)) {
      return res.status(403).json({ error: 'Sin permisos para esta acción' });
    }
    next();
  };
