'use strict';

const { TareaProgramada, Equipo, Proyecto } = require('../models');
const { wsId } = require('../utils/workspace');

// ── Helpers ──────────────────────────────────────────────────────────────────

// Acepta "HH:MM" o "HH:MM:SS"; rechaza cualquier otro formato
function normalizarHora(hora) {
  if (/^\d{2}:\d{2}$/.test(hora))    return `${hora}:00`;
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

const tareaIncludes = [
  {
    model: Equipo,
    as: 'equipo',
    attributes: ['id', 'nombre', 'tecnico_asignado_id'],
    include: [{ model: Proyecto, as: 'proyecto', attributes: ['id', 'nombre', 'workspace_id'] }],
  },
];

// Carga la tarea verificando acceso por workspace
async function findTareaConAcceso(tareaId, workspaceId) {
  const tarea = await TareaProgramada.findByPk(tareaId, { include: tareaIncludes });
  if (!tarea) return null;
  if (workspaceId && tarea.equipo.proyecto.workspace_id !== workspaceId) return null;
  return tarea;
}

// Verifica que un equipo pertenece al workspace del usuario
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
      // Filtrar por equipo si se pasa ?equipo_id=X
      const whereEquipo = {};
      if (req.query.equipo_id) whereEquipo.id = req.query.equipo_id;

      const tareas = await TareaProgramada.findAll({
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
              // Filtro por workspace cuando no es superadmin
              ...(wsId(req) ? { where: { workspace_id: wsId(req) } } : {}),
            }],
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
      const tarea = await findTareaConAcceso(req.params.id, wsId(req));
      if (!tarea) return res.status(404).json({ error: 'Tarea programada no encontrada' });
      return res.json(tarea);
    } catch (err) {
      console.error('[tarea/getOne]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async create(req, res) {
    try {
      const { equipo_id, hora, dias_semana, activa } = req.body;

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

      const tarea = await TareaProgramada.create({
        equipo_id,
        hora: horaNorm,
        dias_semana,
        activa: activa !== undefined ? Boolean(activa) : true,
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
      const tarea = await findTareaConAcceso(req.params.id, wsId(req));
      if (!tarea) return res.status(404).json({ error: 'Tarea programada no encontrada' });

      const updates = {};

      if (req.body.hora !== undefined) {
        const horaNorm = normalizarHora(req.body.hora);
        if (!horaNorm) {
          return res.status(400).json({ error: 'hora debe tener formato HH:MM o HH:MM:SS' });
        }
        updates.hora = horaNorm;
      }

      if (req.body.dias_semana !== undefined) {
        if (!validarDias(req.body.dias_semana)) {
          return res.status(400).json({
            error: 'dias_semana debe ser un array no vacío de enteros entre 0 y 6',
          });
        }
        updates.dias_semana = req.body.dias_semana;
      }

      if (req.body.activa !== undefined) updates.activa = Boolean(req.body.activa);

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
      const tarea = await findTareaConAcceso(req.params.id, wsId(req));
      if (!tarea) return res.status(404).json({ error: 'Tarea programada no encontrada' });

      await tarea.destroy();
      return res.json({ message: 'Tarea programada eliminada correctamente' });
    } catch (err) {
      console.error('[tarea/remove]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // PATCH /:id/toggle — activa o desactiva sin enviar el body completo
  async toggle(req, res) {
    try {
      const tarea = await findTareaConAcceso(req.params.id, wsId(req));
      if (!tarea) return res.status(404).json({ error: 'Tarea programada no encontrada' });

      await tarea.update({ activa: !tarea.activa });
      return res.json({ id: tarea.id, activa: tarea.activa });
    } catch (err) {
      console.error('[tarea/toggle]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },
};

module.exports = tareaController;
