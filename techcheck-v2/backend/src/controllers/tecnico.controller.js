'use strict';

const { Tecnico } = require('../models');
const { wsId } = require('../utils/workspace');

const tecnicoController = {
  async list(req, res) {
    try {
      const where = {};
      const ws = wsId(req);
      if (ws) where.workspace_id = ws;

      const tecnicos = await Tecnico.findAll({
        where,
        order: [['nombre', 'ASC']],
      });
      return res.json(tecnicos);
    } catch (err) {
      console.error('[tecnico/list]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async create(req, res) {
    try {
      const { nombre, email } = req.body;
      if (!nombre) return res.status(400).json({ error: 'nombre es requerido' });

      const workspaceId = req.user.rol === 'superadmin' ? req.body.workspace_id : req.user.workspace_id;
      if (!workspaceId) return res.status(400).json({ error: 'workspace_id es requerido' });

      const tecnico = await Tecnico.create({ workspace_id: workspaceId, nombre, email: email || null });
      return res.status(201).json(tecnico);
    } catch (err) {
      console.error('[tecnico/create]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async update(req, res) {
    try {
      const ws = wsId(req);
      const where = { id: req.params.id, ...(ws ? { workspace_id: ws } : {}) };
      const tecnico = await Tecnico.findOne({ where });
      if (!tecnico) return res.status(404).json({ error: 'Técnico no encontrado' });

      const { nombre, email, activo } = req.body;
      await tecnico.update({ nombre, email, activo });
      return res.json(tecnico);
    } catch (err) {
      console.error('[tecnico/update]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async remove(req, res) {
    try {
      const ws = wsId(req);
      const where = { id: req.params.id, ...(ws ? { workspace_id: ws } : {}) };
      const tecnico = await Tecnico.findOne({ where });
      if (!tecnico) return res.status(404).json({ error: 'Técnico no encontrado' });

      await tecnico.destroy();
      return res.json({ message: 'Técnico eliminado correctamente' });
    } catch (err) {
      console.error('[tecnico/remove]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },
};

module.exports = tecnicoController;
