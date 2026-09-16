const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/dataAccess');
const auth = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'techcheck_secret_dev';
const ACCESS_TTL = process.env.JWT_EXPIRES_IN || '8h';
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function signAccess(usuario) {
  return jwt.sign({ sub: usuario.id, rol: usuario.rol }, JWT_SECRET, { expiresIn: ACCESS_TTL });
}

function setRefreshCookie(res, rawToken) {
  res.cookie('tc_refresh', rawToken, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: REFRESH_TTL_MS,
    secure: process.env.NODE_ENV === 'production',
  });
}

// GET /api/auth/setup-needed — público: indica si aún no hay ningún admin
router.get('/setup-needed', (req, res) => {
  res.json({ success: true, data: { needsSetup: !db.hasAdmin() } });
});

// POST /api/auth/setup — público: crea el primer admin (solo si no existe ninguno)
router.post('/setup', async (req, res) => {
  try {
    if (db.hasAdmin()) {
      return res.status(403).json({ success: false, message: 'Ya existe un administrador en el sistema' });
    }
    const { nombre, username, password } = req.body;
    if (!nombre || !username || !password) {
      return res.status(400).json({ success: false, message: 'Nombre, usuario y contraseña son requeridos' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 8 caracteres' });
    }
    const existe = db.getUsuarioByUsername(username.trim().toLowerCase());
    if (existe) {
      return res.status(400).json({ success: false, message: 'Ese nombre de usuario ya está en uso' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const admin = db.createUsuario({
      id: uuidv4(),
      nombre: nombre.trim(),
      username: username.trim().toLowerCase(),
      passwordHash,
      rol: 'admin',
      activo: true,
      creadoEn: new Date().toISOString(),
    });

    // Iniciar sesión automáticamente
    const accessToken = signAccess(admin);
    const rawRefresh = crypto.randomBytes(64).toString('hex');
    const tokenHash = hashToken(rawRefresh);
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS).toISOString();
    db.createRefreshToken({ id: uuidv4(), usuarioId: admin.id, tokenHash, expiresAt });
    setRefreshCookie(res, rawRefresh);

    res.status(201).json({
      success: true,
      data: {
        access_token: accessToken,
        token_type: 'Bearer',
        user: { id: admin.id, nombre: admin.nombre, username: admin.username, rol: admin.rol },
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Nombre de usuario y contraseña requeridos' });
    }

    const usuario = db.getUsuarioByUsername(username.trim().toLowerCase());
    const hashToCompare = usuario?.passwordHash || '$2b$12$invalidhashXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
    const ok = await bcrypt.compare(password, hashToCompare);

    if (!usuario || !ok || !usuario.activo) {
      return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }

    const accessToken = signAccess(usuario);
    const rawRefresh = crypto.randomBytes(64).toString('hex');
    const tokenHash = hashToken(rawRefresh);
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS).toISOString();

    db.createRefreshToken({ id: uuidv4(), usuarioId: usuario.id, tokenHash, expiresAt });
    setRefreshCookie(res, rawRefresh);

    res.json({
      success: true,
      data: {
        access_token: accessToken,
        token_type: 'Bearer',
        user: { id: usuario.id, nombre: usuario.nombre, username: usuario.username, rol: usuario.rol },
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const rawRefresh = req.cookies?.tc_refresh || req.body?.refresh_token;
    if (!rawRefresh) {
      return res.status(401).json({ success: false, message: 'Refresh token requerido' });
    }

    const tokenHash = hashToken(rawRefresh);
    const tokenRow = db.getRefreshToken(tokenHash);

    if (!tokenRow || new Date(tokenRow.expiresAt) < new Date()) {
      return res.status(401).json({ success: false, message: 'Refresh token inválido o expirado' });
    }

    const usuario = db.getUsuarioById(tokenRow.usuarioId);
    if (!usuario || !usuario.activo) {
      db.deleteRefreshToken(tokenHash);
      return res.status(403).json({ success: false, message: 'Usuario inactivo' });
    }

    const newRaw = crypto.randomBytes(64).toString('hex');
    const newHash = hashToken(newRaw);
    const newExpires = new Date(Date.now() + REFRESH_TTL_MS).toISOString();
    db.rotateRefreshToken(tokenHash, newHash, newExpires);
    setRefreshCookie(res, newRaw);

    const accessToken = signAccess(usuario);
    res.json({ success: true, data: { access_token: accessToken, token_type: 'Bearer' } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', auth, (req, res) => {
  try {
    const rawRefresh = req.cookies?.tc_refresh || req.body?.refresh_token;
    if (rawRefresh) db.deleteRefreshToken(hashToken(rawRefresh));
    res.clearCookie('tc_refresh', { path: '/api/auth' });
    res.json({ success: true, message: 'Sesión cerrada' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/auth/me
router.get('/me', auth, (req, res) => {
  try {
    const usuario = db.getUsuarioById(req.user.sub);
    if (!usuario) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    res.json({
      success: true,
      data: { id: usuario.id, nombre: usuario.nombre, username: usuario.username, rol: usuario.rol }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/auth/mis-permisos — permisos especiales del usuario autenticado
router.get('/mis-permisos', auth, (req, res) => {
  try {
    const permisos = db.getPermisosEspeciales(req.user.sub);
    res.json({ success: true, data: permisos });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/change-password
router.post('/change-password', auth, async (req, res) => {
  try {
    const { password_actual, password_nuevo } = req.body;
    if (!password_actual || !password_nuevo) {
      return res.status(400).json({ success: false, message: 'Contraseñas requeridas' });
    }
    if (password_nuevo.length < 8) {
      return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 8 caracteres' });
    }

    const usuario = db.getUsuarioById(req.user.sub);
    if (!usuario) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    const ok = await bcrypt.compare(password_actual, usuario.passwordHash);
    if (!ok) return res.status(401).json({ success: false, message: 'Contraseña actual incorrecta' });

    const nuevoHash = await bcrypt.hash(password_nuevo, 12);
    db.updateUsuarioPassword(usuario.id, nuevoHash);
    db.deleteRefreshTokensByUsuario(usuario.id);
    res.clearCookie('tc_refresh', { path: '/api/auth' });

    res.json({ success: true, message: 'Contraseña actualizada. Inicia sesión nuevamente.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
