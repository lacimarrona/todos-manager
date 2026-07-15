'use strict';

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { Usuario, RefreshToken, Workspace, UsuarioWorkspace } = require('../models');

const BCRYPT_COST = 12;

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días en ms

// Construye el payload JWT usando el rol específico del workspace (ws_rol),
// no el rol global. Para superadmin devuelve el rol global directamente.
async function buildPayload(usuario, wsId) {
  if (usuario.rol === 'superadmin') {
    return { sub: usuario.id, rol: 'superadmin', workspace_id: null };
  }
  const workspaceId = wsId ?? usuario.workspace_id;
  let wsRol = 'usuario';
  if (workspaceId) {
    const membership = await UsuarioWorkspace.findOne({
      where: { usuario_id: usuario.id, workspace_id: workspaceId },
      attributes: ['ws_rol'],
    });
    wsRol = membership?.ws_rol ?? 'usuario';
  }
  return { sub: usuario.id, rol: wsRol, workspace_id: workspaceId };
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
        const maskedEmail = email.replace(/^(.).+(@.+)$/, '$1***$2');
        console.warn('[security] login_failed', { email: maskedEmail, ip: req.ip, ts: new Date().toISOString() });
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      const accessToken = generateAccessToken(await buildPayload(usuario));

      const rawRefresh = crypto.randomBytes(64).toString('hex');
      await RefreshToken.create({
        usuario_id: usuario.id,
        token_hash: hashToken(rawRefresh),
        expires_at: new Date(Date.now() + REFRESH_TTL_MS),
        user_agent: req.headers['user-agent']?.slice(0, 500) ?? null,
        ip: req.ip ?? null,
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

      const accessToken = generateAccessToken(await buildPayload(stored.usuario));

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

      const hash = await bcrypt.hash(password_nuevo, BCRYPT_COST);
      await usuario.update({ password_hash: hash });

      // Invalidar todas las sesiones activas para forzar re-login
      await RefreshToken.destroy({ where: { usuario_id: usuario.id } });
      res.clearCookie('tc_refresh', { ...COOKIE_OPTS, maxAge: 0 });

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

      // El JWT lleva el rol del workspace activo (ws_rol), no el rol global de usuarios.
      // Sobreescribir para que el frontend siempre reciba el rol correcto del workspace actual.
      const data = usuario.toJSON();
      data.rol = req.user.rol;
      return res.json(data);
    } catch (err) {
      console.error('[auth/me]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async sessions(req, res) {
    try {
      const tokens = await RefreshToken.findAll({
        where: { usuario_id: req.user.sub },
        attributes: ['id', 'user_agent', 'ip', 'created_at', 'expires_at'],
        order: [['created_at', 'DESC']],
      });
      return res.json(tokens);
    } catch (err) {
      console.error('[auth/sessions]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async revokeSession(req, res) {
    try {
      const { id } = req.params;
      const token = await RefreshToken.findOne({
        where: { id, usuario_id: req.user.sub },
      });
      if (!token) return res.status(404).json({ error: 'Sesión no encontrada' });
      await token.destroy();
      return res.json({ message: 'Sesión cerrada' });
    } catch (err) {
      console.error('[auth/revokeSession]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async revokeOtherSessions(req, res) {
    try {
      const currentToken = req.cookies?.tc_refresh;
      const where = { usuario_id: req.user.sub };
      if (currentToken) {
        where.token_hash = { [Op.ne]: hashToken(currentToken) };
      }
      const count = await RefreshToken.destroy({ where });
      return res.json({ message: `${count} sesión(es) cerrada(s)` });
    } catch (err) {
      console.error('[auth/revokeOtherSessions]', err);
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

      const usuario = await Usuario.findByPk(req.user.sub);
      const accessToken = generateAccessToken(await buildPayload(usuario, workspace_id));

      return res.json({ access_token: accessToken, token_type: 'Bearer' });
    } catch (err) {
      console.error('[auth/switchWorkspace]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },
};

module.exports = authController;
