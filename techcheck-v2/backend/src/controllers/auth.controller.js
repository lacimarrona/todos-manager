'use strict';

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Usuario, RefreshToken, Workspace, UsuarioWorkspace } = require('../models');

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días en ms

function buildPayload(usuario) {
  return {
    sub: usuario.id,
    rol: usuario.rol,
    workspace_id: usuario.workspace_id,
  };
}

const COOKIE_OPTS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path:     '/api/auth',
  maxAge:   7 * 24 * 60 * 60 * 1000, // 7 días en ms
};

function generateAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
}

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function safeUser(usuario) {
  const { password_hash, ...rest } = usuario.toJSON();
  return rest;
}

async function userWithWorkspaces(usuario) {
  const u = await Usuario.findByPk(usuario.id, {
    attributes: { exclude: ['password_hash'] },
    include: [{ model: Workspace, as: 'workspaces', through: { attributes: [] }, attributes: ['id', 'nombre'] }],
  });
  return u ? u.toJSON() : safeUser(usuario);
}

const authController = {
  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email y contraseña son requeridos' });
      }

      const usuario = await Usuario.findOne({ where: { email } });

      // Verificar activo antes de bcrypt para evitar timing side-channel en cuentas desactivadas;
      // el mismo mensaje genérico oculta si el email existe o si la cuenta está activa.
      if (!usuario || usuario.activo === false) {
        // Si existe, ejecutar bcrypt igualmente para que el timing sea uniforme
        if (usuario) await bcrypt.compare(password, usuario.password_hash);
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      const valid = await bcrypt.compare(password, usuario.password_hash);
      if (!valid) {
        console.warn('[security] login_failed', { email, ip: req.ip, ts: new Date().toISOString() });
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      const accessToken = generateAccessToken(buildPayload(usuario));

      const rawRefresh = crypto.randomBytes(64).toString('hex');
      await RefreshToken.create({
        usuario_id: usuario.id,
        token_hash: hashToken(rawRefresh),
        expires_at: new Date(Date.now() + REFRESH_TTL_MS),
      });

      // httpOnly cookie para web; también en body para clientes móviles/API
      res.cookie('tc_refresh', rawRefresh, COOKIE_OPTS);

      return res.json({
        access_token: accessToken,
        refresh_token: rawRefresh,
        token_type: 'Bearer',
        user: await userWithWorkspaces(usuario),
      });
    } catch (err) {
      console.error('[auth/login]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async refresh(req, res) {
    try {
      const { refresh_token } = req.body;

      // Prioridad: cookie httpOnly (web) → body (móvil/API)
      const token = req.cookies?.tc_refresh || refresh_token;
      if (!token) {
        return res.status(400).json({ error: 'refresh_token es requerido' });
      }

      const stored = await RefreshToken.findOne({
        where: { token_hash: hashToken(token) },
        include: [{ model: Usuario, as: 'usuario' }],
      });

      if (!stored || stored.expires_at < new Date()) {
        return res.status(401).json({ error: 'Refresh token inválido o expirado' });
      }

      if (!stored.usuario || stored.usuario.activo === false) {
        await stored.destroy();
        return res.status(403).json({ error: 'Cuenta desactivada' });
      }

      const accessToken = generateAccessToken(buildPayload(stored.usuario));

      // Rotar el refresh token para invalidar el anterior
      const rawRefresh = crypto.randomBytes(64).toString('hex');
      await stored.update({
        token_hash: hashToken(rawRefresh),
        expires_at: new Date(Date.now() + REFRESH_TTL_MS),
      });

      res.cookie('tc_refresh', rawRefresh, COOKIE_OPTS);

      return res.json({
        access_token: accessToken,
        refresh_token: rawRefresh, // móvil lo usa directamente; web usa la cookie
        token_type: 'Bearer',
      });
    } catch (err) {
      console.error('[auth/refresh]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async logout(req, res) {
    try {
      const { refresh_token } = req.body;
      const token = req.cookies?.tc_refresh || refresh_token;

      if (token) {
        await RefreshToken.destroy({ where: { token_hash: hashToken(token) } });
      }

      res.clearCookie('tc_refresh', { ...COOKIE_OPTS, maxAge: 0 });
      return res.json({ message: 'Sesión cerrada correctamente' });
    } catch (err) {
      console.error('[auth/logout]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async changePassword(req, res) {
    try {
      const { password_actual, password_nuevo } = req.body;
      if (!password_actual || !password_nuevo) {
        return res.status(400).json({ error: 'password_actual y password_nuevo son requeridos' });
      }
      if (password_nuevo.length < 12) {
        return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 12 caracteres' });
      }
      if (password_nuevo === password_actual) {
        return res.status(400).json({ error: 'La nueva contraseña debe ser diferente a la actual' });
      }

      const usuario = await Usuario.findByPk(req.user.sub);
      if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

      const valid = await bcrypt.compare(password_actual, usuario.password_hash);
      if (!valid) return res.status(401).json({ error: 'Contraseña actual incorrecta' });

      const hash = await bcrypt.hash(password_nuevo, 10);
      await usuario.update({ password_hash: hash });

      return res.json({ message: 'Contraseña actualizada correctamente' });
    } catch (err) {
      console.error('[auth/changePassword]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async me(req, res) {
    try {
      const usuario = await Usuario.findByPk(req.user.sub, {
        attributes: { exclude: ['password_hash'] },
        include: [{ model: Workspace, as: 'workspaces', through: { attributes: [] }, attributes: ['id', 'nombre'] }],
      });

      if (!usuario) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      return res.json(usuario);
    } catch (err) {
      console.error('[auth/me]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async switchWorkspace(req, res) {
    try {
      const { workspace_id } = req.body;
      if (!workspace_id) return res.status(400).json({ error: 'workspace_id es requerido' });

      const membership = await UsuarioWorkspace.findOne({
        where: { usuario_id: req.user.sub, workspace_id },
      });
      if (!membership) return res.status(403).json({ error: 'No perteneces a ese workspace' });

      // Persistir workspace activo en BD para que /me y el refresh devuelvan el nuevo workspace
      await Usuario.update({ workspace_id }, { where: { id: req.user.sub } });

      const newPayload = { sub: req.user.sub, rol: req.user.rol, workspace_id };
      const accessToken = generateAccessToken(newPayload);

      return res.json({ access_token: accessToken, token_type: 'Bearer' });
    } catch (err) {
      console.error('[auth/switchWorkspace]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },
};

module.exports = authController;
