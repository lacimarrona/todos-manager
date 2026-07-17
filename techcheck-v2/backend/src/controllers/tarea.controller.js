'use strict';

const { Op } = require('sequelize');
const { TareaProgramada, Equipo, Proyecto, Usuario, GrupoElemento, ElementoGrupo } = require('../models');
const { wsId } = require('../utils/workspace');

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizarHora(hora) {
  if (/^\d{2}:\d{2}$/.test(hora))       return `${hora}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(hora)) return hora;
  return null;
}

function validarDias(dias) {
  return (
    Array.isArray(dias) &&
    dias.length > 0 &&
    dias.every(d => Number.isInteger(Number(d)) && Number(d) >= 0 && Number(d) <= 6)
  );
}

const usuarioAttrs = ['id', 'nombre', 'email'];

const tareaIncludes = [
  {
    model: Equipo,
    as: 'equipo',
    attributes: ['id', 'nombre', 'tecnico_asignado_id'],
    include: [{ model: Proyecto, as: 'proyecto', attributes: ['id', 'nombre', 'workspace_id'] }],
  },
  { model: Usuario, as: 'asignado_a', attributes: usuarioAttrs, required: false },
  { model: Usuario, as: 'creado_por', attributes: usuarioAttrs, required: false },
  {
    model: GrupoElemento,
    as: 'grupo_elemento',
    attributes: ['id', 'nombre'],
    required: false,
    include: [{ model: ElementoGrupo, as: 'elementos', where: { activo: true }, required: false, attributes: ['id', 'valor', 'descripcion'] }],
  },
];

async function findTareaConAcceso(tareaId, req) {
  const tarea = await TareaProgramada.findByPk(tareaId, { include: tareaIncludes });
  if (!tarea) return null;
  const wid = wsId(req);
  if (wid && tarea.equipo.proyecto.workspace_id !== wid) return null;

  // Usuarios solo ven sus propias tareas
  if (req.user.rol === 'usuario') {
    if (tarea.asignado_a_id !== req.user.sub && tarea.creado_por_id !== req.user.sub) return null;
  }
  return tarea;
}

async function findEquipoConAcceso(equipoId, workspaceId) {
  const equipo = await Equipo.findByPk(equipoId, {
    include: [{ model: Proyecto, as: 'proyecto', attributes: ['id', 'workspace_id'] }],
  });
  if (!equipo) return null;
  if (workspaceId && equipo.proyecto.workspace_id !== workspaceId) return null;
  return equipo;
}

// ── Controlador ──────────────────────────────────────────────────────────────

const tareaController = {
  async list(req, res) {
    try {
      const whereEquipo = {};
      if (req.query.equipo_id) whereEquipo.id = req.query.equipo_id;

      // Usuarios normales solo ven sus tareas asignadas o creadas por ellos
      const whereTarea = {};
      if (req.user.rol === 'usuario') {
        whereTarea[Op.or] = [
          { asignado_a_id: req.user.sub },
          { creado_por_id: req.user.sub },
        ];
      }

      const tareas = await TareaProgramada.findAll({
        where: whereTarea,
        include: [
          {
            model: Equipo,
            as: 'equipo',
            where: whereEquipo,
            required: true,
            include: [{
              model: Proyecto,
              as: 'proyecto',
              attributes: ['id', 'nombre', 'workspace_id'],
              ...(wsId(req) ? { where: { workspace_id: wsId(req) } } : {}),
            }],
          },
          { model: Usuario, as: 'asignado_a', attributes: usuarioAttrs, required: false },
          { model: Usuario, as: 'creado_por', attributes: usuarioAttrs, required: false },
          {
            model: GrupoElemento,
            as: 'grupo_elemento',
            attributes: ['id', 'nombre'],
            required: false,
            include: [{ model: ElementoGrupo, as: 'elementos', where: { activo: true }, required: false, attributes: ['id', 'valor', 'descripcion'] }],
          },
        ],
        order: [['id', 'DESC']],
      });
      return res.json(tareas);
    } catch (err) {
      console.error('[tarea/list]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async getOne(req, res) {
    try {
      const tarea = await findTareaConAcceso(req.params.id, req);
      if (!tarea) return res.status(404).json({ error: 'Tarea programada no encontrada' });
      return res.json(tarea);
    } catch (err) {
      console.error('[tarea/getOne]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async create(req, res) {
    try {
      const { equipo_id, hora, dias_semana, activa, asignado_a_id, fecha_fin } = req.body;

      if (!equipo_id) return res.status(400).json({ error: 'equipo_id es requerido' });

      const horaNorm = normalizarHora(hora);
      if (!horaNorm) {
        return res.status(400).json({ error: 'hora debe tener formato HH:MM o HH:MM:SS' });
      }
      if (!validarDias(dias_semana)) {
        return res.status(400).json({
          error: 'dias_semana debe ser un array no vacío de enteros entre 0 (dom) y 6 (sáb)',
        });
      }

      const equipo = await findEquipoConAcceso(equipo_id, wsId(req));
      if (!equipo) return res.status(404).json({ error: 'Equipo no encontrado' });

      // Solo admins pueden asignar la tarea a otro usuario; usuarios siempre se asignan a sí mismos
      const asignadoId = req.user.rol !== 'usuario' && asignado_a_id ? asignado_a_id : null;

      const { grupo_elemento_id } = req.body;
      const tarea = await TareaProgramada.create({
        equipo_id,
        hora:             horaNorm,
        dias_semana,
        activa:           activa !== undefined ? Boolean(activa) : true,
        asignado_a_id:    asignadoId,
        creado_por_id:    req.user.sub,
        fecha_fin:        fecha_fin || null,
        grupo_elemento_id: grupo_elemento_id || null,
      });

      await tarea.reload({ include: tareaIncludes });
      return res.status(201).json(tarea);
    } catch (err) {
      console.error('[tarea/create]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async update(req, res) {
    try {
      const tarea = await findTareaConAcceso(req.params.id, req);
      if (!tarea) return res.status(404).json({ error: 'Tarea programada no encontrada' });

      // Usuario solo edita sus propias tareas
      if (req.user.rol === 'usuario') {
        if (tarea.creado_por_id !== req.user.sub) {
          return res.status(403).json({ error: 'No tienes permiso para editar esta tarea' });
        }
      }

      const updates = {};

      if (req.body.hora !== undefined) {
        const horaNorm = normalizarHora(req.body.hora);
        if (!horaNorm) return res.status(400).json({ error: 'hora debe tener formato HH:MM o HH:MM:SS' });
        updates.hora = horaNorm;
      }
      if (req.body.dias_semana !== undefined) {
        if (!validarDias(req.body.dias_semana)) {
          return res.status(400).json({ error: 'dias_semana debe ser un array no vacío de enteros entre 0 y 6' });
        }
        updates.dias_semana = req.body.dias_semana;
      }
      if (req.body.activa !== undefined) updates.activa = Boolean(req.body.activa);
      if (req.body.fecha_fin !== undefined) updates.fecha_fin = req.body.fecha_fin || null;

      // Solo admin puede reasignar y cambiar grupo
      if (req.user.rol !== 'usuario') {
        if (req.body.asignado_a_id !== undefined) updates.asignado_a_id = req.body.asignado_a_id || null;
        if (req.body.grupo_elemento_id !== undefined) updates.grupo_elemento_id = req.body.grupo_elemento_id || null;
      }

      await tarea.update(updates);
      await tarea.reload({ include: tareaIncludes });
      return res.json(tarea);
    } catch (err) {
      console.error('[tarea/update]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async remove(req, res) {
    try {
      const tarea = await findTareaConAcceso(req.params.id, req);
      if (!tarea) return res.status(404).json({ error: 'Tarea programada no encontrada' });

      if (req.user.rol === 'usuario' && tarea.creado_por_id !== req.user.sub) {
        return res.status(403).json({ error: 'No tienes permiso para eliminar esta tarea' });
      }

      await tarea.destroy();
      return res.json({ message: 'Tarea programada eliminada correctamente' });
    } catch (err) {
      console.error('[tarea/remove]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async toggle(req, res) {
    try {
      const tarea = await findTareaConAcceso(req.params.id, req);
      if (!tarea) return res.status(404).json({ error: 'Tarea programada no encontrada' });

      if (req.user.rol === 'usuario' && tarea.creado_por_id !== req.user.sub) {
        return res.status(403).json({ error: 'No tienes permiso para modificar esta tarea' });
      }

      await tarea.update({ activa: !tarea.activa });
      return res.json({ id: tarea.id, activa: tarea.activa });
    } catch (err) {
      console.error('[tarea/toggle]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },
};

module.exports = tareaController;
