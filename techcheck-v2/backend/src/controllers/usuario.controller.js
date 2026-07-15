'use strict';

const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const { Usuario, Workspace, UsuarioWorkspace } = require('../models');

function omitPassword(usuario) {
  const { password_hash, ...data } = usuario.toJSON();
  return data;
}

// Devuelve el workspace_id a aplicar segÃºn el rol del solicitante
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
      if (password.length < 12) {
        return res.status(400).json({ error: 'La contraseÃ±a debe tener al menos 12 caracteres' });
      }

      // Admin solo puede crear usuarios en su propio workspace con rol 'usuario'
      const rolFinal = req.user.rol === 'superadmin' ? (rol || 'usuario') : 'usuario';
      const workspaceId = req.user.rol === 'superadmin' ? (workspace_id ?? null) : req.user.workspace_id;

      if (rolFinal !== 'superadmin' && !workspaceId) {
        return res.status(400).json({ error: 'workspace_id es requerido' });
      }

      const existing = await Usuario.findOne({ where: { email } });
      if (existing) return res.status(409).json({ error: 'El email ya estÃ¡ registrado' });

      const hash = await bcrypt.hash(password, 12);
      const nuevo = await Usuario.create({
        workspace_id: workspaceId,
        nombre,
        email,
        password_hash: hash,
        rol: rolFinal,
      });

      // Registrar membresÃ­a en tabla de junction con el rol del workspace
      if (workspaceId) {
        const ws_rol_inicial = req.user.rol === 'superadmin' && rolFinal === 'admin' ? 'admin' : 'usuario';
        await UsuarioWorkspace.findOrCreate({
          where: { usuario_id: nuevo.id, workspace_id: workspaceId },
          defaults: { ws_rol: ws_rol_inicial },
        });
      }

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

      // Nadie puede editar al superadmin salvo Ã©l mismo
      if (usuario.rol === 'superadmin' && req.user.sub !== usuario.id) {
        return res.status(403).json({ error: 'No puedes editar al superadmin' });
      }

      // Admin no puede escalar privilegios
      if (req.user.rol === 'admin' && req.body.rol && req.body.rol !== 'usuario') {
        return res.status(403).json({ error: 'No puedes asignar ese rol' });
      }

      if (req.body.password && req.body.password.length < 12) {
        return res.status(400).json({ error: 'La contraseÃ±a debe tener al menos 12 caracteres' });
      }

      const updates = {};
      if (req.body.nombre)  updates.nombre = req.body.nombre;
      if (req.body.email)   updates.email  = req.body.email;
      if (req.body.password) updates.password_hash = await bcrypt.hash(req.body.password, 12);
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

// â”€â”€ GestiÃ³n de membresÃ­as de workspace (solo superadmin) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const workspaceMembershipController = {
  // GET /api/usuarios/:id/workspaces
  async listWorkspaces(req, res) {
    try {
      const usuario = await Usuario.findByPk(req.params.id, {
        include: [{ model: Workspace, as: 'workspaces', through: { attributes: [] }, attributes: ['id', 'nombre'] }],
      });
      if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
      return res.json(usuario.workspaces);
    } catch (err) {
      console.error('[usuario/listWorkspaces]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // POST /api/usuarios/:id/workspaces  { workspace_id, ws_rol? }
  async addWorkspace(req, res) {
    try {
      const usuario = await Usuario.findByPk(req.params.id);
      if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
      if (usuario.rol === 'superadmin') return res.status(400).json({ error: 'El superadmin no pertenece a workspaces' });

      const { workspace_id, ws_rol } = req.body;
      if (!workspace_id) return res.status(400).json({ error: 'workspace_id es requerido' });

      const wsRolFinal = ws_rol === 'admin' ? 'admin' : 'usuario';

      const workspace = await Workspace.findByPk(workspace_id);
      if (!workspace) return res.status(404).json({ error: 'Workspace no encontrado' });

      const [membership, created] = await UsuarioWorkspace.findOrCreate({
        where: { usuario_id: usuario.id, workspace_id },
        defaults: { ws_rol: wsRolFinal },
      });

      // Si ya existÃ­a la membresÃ­a, actualizar el ws_rol si viene en el body
      if (!created && ws_rol !== undefined) {
        await membership.update({ ws_rol: wsRolFinal });
      }

      // Si el usuario no tenÃ­a workspace activo, asignarlo
      if (!usuario.workspace_id) {
        await usuario.update({ workspace_id });
      }

      return res.status(created ? 201 : 200).json({
        message: 'MembresÃ­a registrada',
        workspace: { id: workspace.id, nombre: workspace.nombre },
        ws_rol: membership.ws_rol,
      });
    } catch (err) {
      console.error('[usuario/addWorkspace]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // DELETE /api/usuarios/:id/workspaces/:workspaceId
  async removeWorkspace(req, res) {
    try {
      const usuario = await Usuario.findByPk(req.params.id);
      if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

      const workspaceId = parseInt(req.params.workspaceId);

      await UsuarioWorkspace.destroy({ where: { usuario_id: usuario.id, workspace_id: workspaceId } });

      // Si era el workspace activo, cambiarlo a otro que tenga o a null
      if (usuario.workspace_id === workspaceId) {
        const otra = await UsuarioWorkspace.findOne({ where: { usuario_id: usuario.id } });
        await usuario.update({ workspace_id: otra ? otra.workspace_id : null });
      }

      return res.json({ message: 'MembresÃ­a eliminada' });
    } catch (err) {
      console.error('[usuario/removeWorkspace]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },
};

module.exports = { usuarioController, workspaceMembershipController };
