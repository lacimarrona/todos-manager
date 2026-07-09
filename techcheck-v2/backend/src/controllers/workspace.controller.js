'use strict';

const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const { Workspace, Usuario } = require('../models');

const workspaceController = {
  async list(req, res) {
    try {
      const workspaces = await Workspace.findAll({
        include: [
          {
            model: Usuario,
            as: 'usuarios',
            attributes: ['id', 'nombre', 'email', 'rol'],
            where: { rol: 'admin' },
            required: false,
          },
        ],
        order: [['created_at', 'DESC']],
      });
      return res.json(workspaces);
    } catch (err) {
      console.error('[workspace/list]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async getOne(req, res) {
    try {
      const workspace = await Workspace.findByPk(req.params.id, {
        include: [
          {
            model: Usuario,
            as: 'usuarios',
            attributes: ['id', 'nombre', 'email', 'rol'],
            required: false,
          },
        ],
      });
      if (!workspace) return res.status(404).json({ error: 'Workspace no encontrado' });
      return res.json(workspace);
    } catch (err) {
      console.error('[workspace/getOne]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async create(req, res) {
    try {
      const { nombre, descripcion } = req.body;
      if (!nombre) return res.status(400).json({ error: 'nombre es requerido' });

      const workspace = await Workspace.create({ nombre, descripcion });
      return res.status(201).json(workspace);
    } catch (err) {
      console.error('[workspace/create]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async update(req, res) {
    try {
      const workspace = await Workspace.findByPk(req.params.id);
      if (!workspace) return res.status(404).json({ error: 'Workspace no encontrado' });

      const { nombre, descripcion, activo } = req.body;
      await workspace.update({ nombre, descripcion, activo });
      return res.json(workspace);
    } catch (err) {
      console.error('[workspace/update]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async remove(req, res) {
    try {
      const workspace = await Workspace.findByPk(req.params.id);
      if (!workspace) return res.status(404).json({ error: 'Workspace no encontrado' });

      await workspace.destroy();
      return res.json({ message: 'Workspace eliminado correctamente' });
    } catch (err) {
      console.error('[workspace/remove]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Busca usuarios sin workspace asignado (disponibles para ser admins)
  async listDisponibles(req, res) {
    try {
      const usuarios = await Usuario.findAll({
        where: {
          rol: { [Op.ne]: 'superadmin' },
          workspace_id: null,
        },
        attributes: ['id', 'nombre', 'email', 'rol'],
        order: [['nombre', 'ASC']],
      });
      return res.json(usuarios);
    } catch (err) {
      console.error('[workspace/listDisponibles]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Asigna un usuario existente como admin del workspace
  async assignExisting(req, res) {
    try {
      const workspace = await Workspace.findByPk(req.params.id);
      if (!workspace) return res.status(404).json({ error: 'Workspace no encontrado' });

      const { userId } = req.body;
      if (!userId) return res.status(400).json({ error: 'userId es requerido' });

      const usuario = await Usuario.findByPk(userId);
      if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
      if (usuario.rol === 'superadmin') {
        return res.status(400).json({ error: 'Un superadmin no puede ser admin de workspace' });
      }
      if (usuario.workspace_id && usuario.workspace_id !== workspace.id) {
        return res.status(409).json({ error: 'El usuario ya pertenece a otro workspace' });
      }

      await usuario.update({ workspace_id: workspace.id, rol: 'admin' });
      const { password_hash, ...data } = usuario.toJSON();
      return res.json(data);
    } catch (err) {
      console.error('[workspace/assignExisting]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Crea un nuevo usuario con rol admin y lo asigna al workspace
  async assignAdmin(req, res) {
    try {
      const workspace = await Workspace.findByPk(req.params.id);
      if (!workspace) return res.status(404).json({ error: 'Workspace no encontrado' });

      const { nombre, email, password } = req.body;
      if (!nombre || !email || !password) {
        return res.status(400).json({ error: 'nombre, email y password son requeridos' });
      }

      const existing = await Usuario.findOne({ where: { email } });
      if (existing) return res.status(409).json({ error: 'El email ya está registrado' });

      const hash = await bcrypt.hash(password, 10);
      const admin = await Usuario.create({
        workspace_id: workspace.id,
        nombre,
        email,
        password_hash: hash,
        rol: 'admin',
      });

      const { password_hash, ...data } = admin.toJSON();
      return res.status(201).json(data);
    } catch (err) {
      console.error('[workspace/assignAdmin]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },
};

module.exports = workspaceController;
