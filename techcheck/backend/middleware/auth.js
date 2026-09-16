const jwt = require('jsonwebtoken');

module.exports = function auth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Token requerido' });
  }
  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'techcheck_secret_dev');
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Token inválido o expirado' });
  }
};
