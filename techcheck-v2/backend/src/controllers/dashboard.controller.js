'use strict';

const { QueryTypes } = require('sequelize');
const { sequelize }  = require('../config/database');
const { wsId }       = require('../utils/workspace');

const dashboardController = {
  async getStats(req, res) {
    try {
      const ws         = wsId(req);
      const wsFilter   = ws ? 'AND p.workspace_id = :wsId' : '';
      const replacements = ws ? { wsId: ws } : {};

      // ── Resumen global de revisiones ─────────────────────────────────────────
      const [resumen] = await sequelize.query(`
        SELECT
          COUNT(*)                              AS total,
          SUM(r.estado = 'terminado')           AS terminadas,
          SUM(r.estado = 'en_proceso')          AS en_proceso,
          SUM(r.estado = 'pendiente')           AS pendientes,
          SUM(r.estado_calidad = 'problema')    AS con_problemas,
          SUM(r.estado_calidad = 'observacion') AS con_observaciones,
          SUM(r.estado_calidad = 'ok')          AS ok
        FROM revisiones r
        JOIN equipos   e ON r.equipo_id    = e.id
        JOIN proyectos p ON e.proyecto_id  = p.id
        WHERE 1=1 ${wsFilter}
      `, { replacements, type: QueryTypes.SELECT });

      // ── Revisiones creadas esta semana (lunes → hoy) ─────────────────────────
      const [semana] = await sequelize.query(`
        SELECT
          COUNT(*)                    AS total,
          SUM(r.estado = 'terminado') AS terminadas
        FROM revisiones r
        JOIN equipos   e ON r.equipo_id   = e.id
        JOIN proyectos p ON e.proyecto_id = p.id
        WHERE r.created_at >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
        ${wsFilter}
      `, { replacements, type: QueryTypes.SELECT });

      // ── Totales de proyectos y equipos activos ───────────────────────────────
      const [totales] = await sequelize.query(`
        SELECT
          COUNT(DISTINCT p.id) AS proyectos_total,
          COUNT(DISTINCT e.id) AS equipos_total
        FROM proyectos p
        LEFT JOIN equipos e ON e.proyecto_id = p.id AND e.archivado = 0
        WHERE 1=1 ${wsFilter}
      `, { replacements, type: QueryTypes.SELECT });

      // ── Top 5 técnicos con más revisiones ────────────────────────────────────
      const topTecnicos = await sequelize.query(`
        SELECT
          u.id,
          u.nombre,
          COUNT(r.id)                    AS total,
          SUM(r.estado = 'terminado')    AS terminadas
        FROM revisiones r
        JOIN usuarios  u ON r.tecnico_id  = u.id
        JOIN equipos   e ON r.equipo_id   = e.id
        JOIN proyectos p ON e.proyecto_id = p.id
        WHERE r.tecnico_id IS NOT NULL ${wsFilter}
        GROUP BY u.id, u.nombre
        ORDER BY total DESC
        LIMIT 5
      `, { replacements, type: QueryTypes.SELECT });

      // ── Top 5 equipos con más revisiones ─────────────────────────────────────
      const topEquipos = await sequelize.query(`
        SELECT
          e.id,
          e.nombre,
          p.nombre                           AS proyecto,
          COUNT(r.id)                        AS total,
          SUM(r.estado_calidad = 'problema') AS problemas
        FROM equipos   e
        JOIN proyectos p ON e.proyecto_id = p.id
        LEFT JOIN revisiones r ON r.equipo_id = e.id
        WHERE e.archivado = 0 ${wsFilter}
        GROUP BY e.id, e.nombre, p.nombre
        ORDER BY total DESC
        LIMIT 5
      `, { replacements, type: QueryTypes.SELECT });

      // ── Últimas 8 revisiones ─────────────────────────────────────────────────
      const recientes = await sequelize.query(`
        SELECT
          r.id,
          e.nombre  AS equipo,
          p.nombre  AS proyecto,
          r.estado,
          r.estado_calidad AS calidad,
          u.nombre  AS tecnico,
          r.updated_at     AS fecha
        FROM revisiones r
        JOIN equipos   e ON r.equipo_id   = e.id
        JOIN proyectos p ON e.proyecto_id = p.id
        LEFT JOIN usuarios u ON r.tecnico_id = u.id
        WHERE 1=1 ${wsFilter}
        ORDER BY r.updated_at DESC
        LIMIT 8
      `, { replacements, type: QueryTypes.SELECT });

      return res.json({
        resumen: {
          total:             Number(resumen.total)             || 0,
          terminadas:        Number(resumen.terminadas)        || 0,
          en_proceso:        Number(resumen.en_proceso)        || 0,
          pendientes:        Number(resumen.pendientes)        || 0,
          con_problemas:     Number(resumen.con_problemas)     || 0,
          con_observaciones: Number(resumen.con_observaciones) || 0,
          ok:                Number(resumen.ok)                || 0,
        },
        esta_semana: {
          total:      Number(semana.total)      || 0,
          terminadas: Number(semana.terminadas) || 0,
        },
        proyectos_total: Number(totales.proyectos_total) || 0,
        equipos_total:   Number(totales.equipos_total)   || 0,
        top_tecnicos: topTecnicos.map(t => ({
          id:         t.id,
          nombre:     t.nombre,
          total:      Number(t.total),
          terminadas: Number(t.terminadas) || 0,
        })),
        top_equipos: topEquipos.map(e => ({
          id:        e.id,
          nombre:    e.nombre,
          proyecto:  e.proyecto,
          total:     Number(e.total),
          problemas: Number(e.problemas) || 0,
        })),
        recientes: recientes.map(r => ({
          id:       r.id,
          equipo:   r.equipo,
          proyecto: r.proyecto,
          estado:   r.estado,
          calidad:  r.calidad,
          tecnico:  r.tecnico,
          fecha:    r.fecha,
        })),
      });
    } catch (err) {
      console.error('[dashboard/getStats]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },
};

module.exports = dashboardController;
