'use strict';

const { QueryTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { Proyecto, Equipo, ItemEquipo, ArchivoGuia, Usuario, Workspace,
        Revision, ItemRevision, ArchivoRevision } = require('../models');
const { wsIdFiltrable: wsId } = require('../utils/workspace');
const { csvCell, csvRow } = require('../utils/csv');

function fmtDate(d) { return d ? new Date(d).toISOString().replace('T', ' ').slice(0, 19) : ''; }

// Verifica que el proyecto pertenece al workspace del usuario
async function findProyectoConAcceso(id, workspaceId) {
  const where = { id };
  if (workspaceId) where.workspace_id = workspaceId;
  return Proyecto.findOne({ where });
}

const proyectoController = {
  async list(req, res) {
    try {
      const where = {};
      const ws = wsId(req);
      if (ws) where.workspace_id = ws;

      const proyectos = await Proyecto.findAll({
        where,
        include: [
          { model: Usuario,   as: 'creador',   attributes: ['id', 'nombre'] },
          { model: Workspace, as: 'workspace', attributes: ['id', 'nombre'] },
        ],
        order: [['nombre', 'ASC']],
      });
      return res.json(proyectos);
    } catch (err) {
      console.error('[proyecto/list]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async getOne(req, res) {
    try {
      const proyecto = await findProyectoConAcceso(req.params.id, wsId(req));
      if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });

      await proyecto.reload({
        include: [
          { model: Usuario,   as: 'creador',   attributes: ['id', 'nombre'] },
          { model: Workspace, as: 'workspace', attributes: ['id', 'nombre'] },
        ],
      });
      return res.json(proyecto);
    } catch (err) {
      console.error('[proyecto/getOne]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async create(req, res) {
    try {
      const { nombre, descripcion, workspace_id } = req.body;
      if (!nombre) return res.status(400).json({ error: 'nombre es requerido' });

      const workspaceId = req.user.rol === 'superadmin'
        ? workspace_id
        : req.user.workspace_id;

      if (!workspaceId) {
        return res.status(400).json({ error: 'workspace_id es requerido' });
      }

      const proyecto = await Proyecto.create({
        workspace_id: workspaceId,
        nombre,
        descripcion,
        creado_por: req.user.sub,
      });
      return res.status(201).json(proyecto);
    } catch (err) {
      console.error('[proyecto/create]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async update(req, res) {
    try {
      const proyecto = await findProyectoConAcceso(req.params.id, wsId(req));
      if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });

      const { nombre, descripcion } = req.body;
      await proyecto.update({ nombre, descripcion });
      return res.json(proyecto);
    } catch (err) {
      console.error('[proyecto/update]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async remove(req, res) {
    try {
      const proyecto = await findProyectoConAcceso(req.params.id, wsId(req));
      if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });

      await proyecto.destroy();
      return res.json({ message: 'Proyecto eliminado correctamente' });
    } catch (err) {
      console.error('[proyecto/remove]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // GET /api/proyectos/:id/equipos?estado=pendiente|en_proceso|terminado
  async listEquipos(req, res) {
    try {
      const proyecto = await findProyectoConAcceso(req.params.id, wsId(req));
      if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });

      const { estado, incluir_archivados } = req.query;
      const ESTADOS_VALIDOS = ['pendiente', 'en_proceso', 'terminado'];
      if (estado && !ESTADOS_VALIDOS.includes(estado)) {
        return res.status(400).json({ error: `estado debe ser: ${ESTADOS_VALIDOS.join(', ')}` });
      }

      const whereEquipos = { proyecto_id: proyecto.id };
      if (!incluir_archivados) whereEquipos.archivado = false;

      // 1. Obtener equipos con items y técnico
      const equipos = await Equipo.findAll({
        where: whereEquipos,
        include: [
          {
            model: ItemEquipo,
            as: 'items',
            required: false,
            include: [{ model: ArchivoGuia, as: 'archivos', required: false }],
            order: [['orden', 'ASC']],
          },
          {
            model: Usuario,
            as: 'tecnico_asignado',
            attributes: ['id', 'nombre', 'email'],
            required: false,
          },
        ],
        order: [['nombre', 'ASC']],
      });

      if (!equipos.length) return res.json([]);

      // 2. Última revisión por equipo en una sola query
      const equipoIds = equipos.map(e => e.id);
      const ultimasRevisiones = await sequelize.query(
        `SELECT r.equipo_id, r.estado
         FROM revisiones r
         INNER JOIN (
           SELECT equipo_id, MAX(id) AS max_id
           FROM revisiones
           WHERE equipo_id IN (:ids)
           GROUP BY equipo_id
         ) t ON r.equipo_id = t.equipo_id AND r.id = t.max_id`,
        { replacements: { ids: equipoIds }, type: QueryTypes.SELECT }
      );

      const revMap = Object.fromEntries(
        ultimasRevisiones.map(r => [r.equipo_id, r.estado])
      );

      // 3. Combinar y filtrar
      const result = equipos
        .map(e => ({ ...e.toJSON(), ultimo_estado: revMap[e.id] || 'pendiente' }))
        .filter(e => !estado || e.ultimo_estado === estado);

      return res.json(result);
    } catch (err) {
      console.error('[proyecto/listEquipos]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // GET /api/proyectos/:id/exportar-csv
  async exportarCSV(req, res) {
    try {
      const proyecto = await findProyectoConAcceso(req.params.id, wsId(req));
      if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });

      // Cargar equipos con items y técnico asignado
      const equipos = await Equipo.findAll({
        where: { proyecto_id: proyecto.id },
        include: [
          {
            model: ItemEquipo,
            as: 'items',
            required: false,
            order: [['orden', 'ASC']],
          },
          { model: Usuario, as: 'tecnico_asignado', attributes: ['nombre'], required: false },
        ],
        order: [['nombre', 'ASC']],
      });

      // Cargar revisiones con sus items y archivos en queries separadas
      const equipoIds = equipos.map(e => e.id);
      let revisiones = [];
      if (equipoIds.length) {
        revisiones = await Revision.findAll({
          where: { equipo_id: equipoIds },
          include: [
            {
              model: ItemRevision,
              as: 'items',
              separate: true,
              order: [['id', 'ASC']],
              include: [{ model: ArchivoRevision, as: 'archivos', required: false }],
            },
            { model: Usuario, as: 'tecnico', attributes: ['nombre'], required: false },
          ],
          order: [['equipo_id', 'ASC'], ['id', 'ASC']],
        });
      }

      // Agrupar revisiones por equipo_id
      const revByEquipo = {};
      for (const r of revisiones) {
        if (!revByEquipo[r.equipo_id]) revByEquipo[r.equipo_id] = [];
        revByEquipo[r.equipo_id].push(r);
      }

      // Construir CSV
      const HEADERS = [
        'Proyecto', 'Equipo', 'Técnico Asignado',
        'Orden', 'Ítem', 'Observación Guía',
        'Rev. ID', 'Fecha Revisión', 'Estado Revisión', 'Técnico Revisión',
        'Obs. General', 'Completado', 'Nota', 'Archivos Evidencia',
      ];

      const lines = [HEADERS.join(',')];

      for (const equipo of equipos) {
        const eqRevisiones = revByEquipo[equipo.id] || [];
        const items = equipo.items || [];
        const tecnicoAsig = equipo.tecnico_asignado?.nombre || '';

        if (!eqRevisiones.length) {
          // Equipo sin revisiones: una fila por ítem con celdas de revisión vacías
          if (!items.length) {
            lines.push(csvRow([proyecto.nombre, equipo.nombre, tecnicoAsig,
              '', '', '', '', '', '', '', '', '', '', '']));
          } else {
            for (const item of items) {
              lines.push(csvRow([proyecto.nombre, equipo.nombre, tecnicoAsig,
                item.orden, item.label, item.observacion_guia || '',
                '', '', 'sin revisión', '', '', '', '', '']));
            }
          }
        } else {
          // Una fila por (revisión × ítem_revisión)
          for (const rev of eqRevisiones) {
            const tecnicoRev = rev.tecnico?.nombre || '';
            const revItems = rev.items || [];

            // Mapear item_id → item de equipo para recuperar observacion_guia y orden
            const itemEquipoMap = Object.fromEntries(items.map(i => [i.id, i]));

            for (const ir of revItems) {
              const ieRef = itemEquipoMap[ir.item_id] || {};
              const archivos = (ir.archivos || []).map(a => a.url).join(' | ');
              lines.push(csvRow([
                proyecto.nombre,
                equipo.nombre,
                tecnicoAsig,
                ieRef.orden ?? '',
                ir.label,
                ieRef.observacion_guia || '',
                rev.id,
                fmtDate(rev.createdAt),
                rev.estado,
                tecnicoRev,
                rev.observacion_general || '',
                ir.checked ? 'Sí' : 'No',
                ir.nota || '',
                archivos,
              ]));
            }
          }
        }
      }

      // BOM para que Excel abra correctamente en UTF-8
      const csv = '﻿' + lines.join('\r\n');
      const filename = `proyecto-${proyecto.id}-${Date.now()}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csv);
    } catch (err) {
      console.error('[proyecto/exportarCSV]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // GET /api/proyectos/:id/exportar-json
  async exportarJSON(req, res) {
    try {
      const proyecto = await findProyectoConAcceso(req.params.id, wsId(req));
      if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });

      const equipos = await Equipo.findAll({
        where: { proyecto_id: proyecto.id },
        include: [
          {
            model: ItemEquipo,
            as: 'items',
            required: false,
            order: [['orden', 'ASC']],
          },
          { model: Usuario, as: 'tecnico_asignado', attributes: ['id', 'nombre', 'email'], required: false },
        ],
        order: [['nombre', 'ASC']],
      });

      const equipoIds = equipos.map(e => e.id);
      let revisiones = [];
      if (equipoIds.length) {
        revisiones = await Revision.findAll({
          where: { equipo_id: equipoIds },
          include: [
            { model: ItemRevision, as: 'items', separate: true, order: [['id', 'ASC']] },
            { model: Usuario, as: 'tecnico', attributes: ['id', 'nombre', 'email'], required: false },
          ],
          order: [['equipo_id', 'ASC'], ['id', 'ASC']],
        });
      }

      return res.json({
        proyecto: proyecto.toJSON(),
        equipos: equipos.map(e => e.toJSON()),
        revisiones: revisiones.map(r => r.toJSON()),
      });
    } catch (err) {
      console.error('[proyecto/exportarJSON]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // POST /api/proyectos/importar-json
  async importarJSON(req, res) {
    try {
      const { proyecto, equipos = [], revisiones = [] } = req.body;
      if (!proyecto?.nombre) return res.status(400).json({ error: 'nombre del proyecto es requerido' });

      const workspaceId = req.user.rol === 'superadmin' ? req.body.workspace_id : req.user.workspace_id;
      if (!workspaceId) return res.status(400).json({ error: 'workspace_id es requerido' });

      const nuevoProyecto = await Proyecto.create({
        workspace_id: workspaceId,
        nombre: proyecto.nombre,
        descripcion: proyecto.descripcion || null,
        creado_por: req.user.sub,
      });

      const equipoIdMap = {};
      for (const eq of equipos) {
        const nuevoEq = await Equipo.create({
          proyecto_id: nuevoProyecto.id,
          nombre: eq.nombre,
          tecnico_asignado_id: null,
          tiempo_limite: eq.tiempo_limite || null,
          archivado: eq.archivado || false,
        });
        equipoIdMap[eq.id] = nuevoEq.id;

        if (Array.isArray(eq.items) && eq.items.length) {
          await ItemEquipo.bulkCreate(
            eq.items.map((it, i) => ({
              equipo_id: nuevoEq.id,
              label: it.label,
              observacion_guia: it.observacion_guia || null,
              orden: it.orden ?? i,
            }))
          );
        }
      }

      // Mapear item_id de revision al nuevo equipo (solo se importan labels, no IDs de items)
      for (const rev of revisiones) {
        const nuevoEquipoId = equipoIdMap[rev.equipo_id];
        if (!nuevoEquipoId) continue;

        const nuevaRev = await Revision.create({
          equipo_id: nuevoEquipoId,
          tecnico_id: null,
          estado: rev.estado || 'terminado',
          observacion_general: rev.observacion_general || null,
          estado_calidad: rev.estado_calidad || null,
        });

        if (Array.isArray(rev.items) && rev.items.length) {
          await ItemRevision.bulkCreate(
            rev.items.map(it => ({
              revision_id: nuevaRev.id,
              item_id: null,
              label: it.label,
              checked: it.checked || false,
              nota: it.nota || null,
            }))
          );
        }
      }

      return res.status(201).json({ message: 'Proyecto importado correctamente', proyecto_id: nuevoProyecto.id });
    } catch (err) {
      console.error('[proyecto/importarJSON]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },
};

module.exports = proyectoController;
