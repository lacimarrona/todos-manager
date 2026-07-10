const jwt = require('jsonwebtoken');

// Replica buildPayload() de src/controllers/auth.controller.js sin pasar por
// bcrypt/login real — más rápido para armar fixtures de test.
function signToken(usuario) {
  const payload = {
    sub: usuario.id,
    email: usuario.email,
    rol: usuario.rol,
    workspace_id: usuario.workspace_id,
  };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
}

module.exports = { signToken };
