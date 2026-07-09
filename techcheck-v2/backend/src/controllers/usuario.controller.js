'use strict';

const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const { Usuario, Workspace } = require('../models');

function omitPassword(usuario) {
  const { password_hash, ...data } = usuario.toJSON();
  return data;
}

// Devuelve el workspace_id a aplicar según el rol del solicitante
function resolveWorkspaceFilter(req) {
  if (req.user.rol === 'admin') return req.user.workspace_id;
  return req.query.workspace_id ? parseInt(req.query.workspace_id) : null;
}

const usuarioController = {
  async list(req, res) {
    try {
      const where = {};
      const workspaceId = resolveWorkspaceFilter(req);
      if (workspaceId) where.workspace_id = workspaceId;

      // Admin no puede ver superadmins ni admins de otros workspaces
      if (req.user.rol === 'admin') {
        where.rol = { [Op.ne]: 'superadmin' };
      }

      const usuarios = await Usuario.findAll({
        where,
        attributes: { exclude: ['password_hash'] },
        include: [{ model: Workspace, as: 'workspace', attributes: ['id', 'nombre'] }],
        order: [['nombre', 'ASC']],
      });
      return res.json(usuarios);
    } catch (err) {
      console.error('[usuario/list]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async getOne(req, res) {
    try {
      const where = { id: req.params.id };
      if (req.user.rol === 'admin') {
        where.workspace_id = req.user.workspace_id;
      }

      const usuario = await Usuario.findOne({
        where,
        attributes: { exclude: ['password_hash'] },
        include: [{ model: Workspace, as: 'workspace', attributes: ['id', 'nombre'] }],
      });
      if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
      return res.json(usuario);
    } catch (err) {
      console.error('[usuario/getOne]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async create(req, res) {
    try {
      const { nombre, email, password, rol, workspace_id } = req.body;
      if (!nombre || !email || !password) {
        return res.status(400).json({ error: 'nombre, email y password son requeridos' });
      }

      // Admin solo puede crear usuarios en su propio workspace con rol 'usuario'
      const rolFinal = req.user.rol === 'superadmin' ? (rol || 'usuario') : 'usuario';
      const workspaceId = req.user.rol === 'superadmin' ? (workspace_id ?? null) : req.user.workspace_id;

      if (rolFinal !== 'superadmin' && !workspaceId) {
        return res.status(400).json({ error: 'workspace_id es requerido' });
      }

      const existing = await Usuario.findOne({ where: { email } });
      if (existing) return res.status(409).json({ error: 'El email ya está registrado' });

      const hash = await bcrypt.hash(password, 10);
      const nuevo = await Usuario.create({
        workspace_id: workspaceId,
        nombre,
        email,
        password_hash: hash,
        rol: rolFinal,
      });

      return res.status(201).json(omitPassword(nuevo));
    } catch (err) {
      console.error('[usuario/create]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async update(req, res) {
    try {
      const where = { id: req.params.id };
      if (req.user.rol === 'admin') {
        where.workspace_id = req.user.workspace_id;
      }

      const usuario = await Usuario.findOne({ where });
      if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

      // Nadie puede editar al superadmin salvo él mismo
      if (usuario.rol === 'superadmin' && req.user.sub !== usuario.id) {
        return res.status(403).json({ error: 'No puedes editar al superadmin' });
      }

      // Admin no puede escalar privilegios
      if (req.user.rol === 'admin' && req.body.rol && req.body.rol !== 'usuario') {
        return res.status(403).json({ error: 'No puedes asignar ese rol' });
      }

      const updates = {};
      if (req.body.nombre)  updates.nombre = req.body.nombre;
      if (req.body.email)   updates.email  = req.body.email;
      if (req.body.password) updates.password_hash = await bcrypt.hash(req.body.password, 10);
      if (req.user.rol === 'superadmin' && req.body.rol) updates.rol = req.body.rol;
      if (req.body.activo !== undefined) updates.activo = req.body.activo;

      await usuario.update(updates);
      return res.json(omitPassword(usuario));
    } catch (err) {
      console.error('[usuario/update]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async remove(req, res) {
    try {
      const where = { id: req.params.id };
      if (req.user.rol === 'admin') {
        where.workspace_id = req.user.workspace_id;
      }

      const usuario = await Usuario.findOne({ where });
      if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

      if (usuario.rol === 'superadmin') {
        return res.status(403).json({ error: 'No se puede eliminar al superadmin' });
      }
      if (usuario.id === req.user.sub) {
        return res.status(403).json({ error: 'No puedes eliminar tu propia cuenta' });
      }

      await usuario.destroy();
      return res.json({ message: 'Usuario eliminado correctamente' });
    } catch (err) {
      console.error('[usuario/remove]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },
};

module.exports = usuarioController;
