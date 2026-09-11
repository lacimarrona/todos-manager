const express = require('express');
const router = express.Router();
const db = require('../db/dataAccess');

// GET /api/dashboard
router.get('/', (req, res) => {
  try {
    const sqliteDb = require('../db/sqlite');

    // Totales básicos
    const totalProyectos = sqliteDb.prepare('SELECT COUNT(*) as n FROM proyectos').get().n;
    const totalEquiposActivos = sqliteDb.prepare('SELECT COUNT(*) as n FROM equipos WHERE archivado = 0').get().n;
    const totalEquiposArchivados = sqliteDb.prepare('SELECT COUNT(*) as n FROM equipos WHERE archivado = 1').get().n;
    const totalRevisiones = sqliteDb.prepare('SELECT COUNT(*) as n FROM revisiones').get().n;
    const totalTecnicos = sqliteDb.prepare('SELECT COUNT(*) as n FROM tecnicos').get().n;

    // Revisiones por estado de la última revisión de cada equipo activo
    const equiposActivos = sqliteDb.prepare(
      `SELECT e.id FROM equipos e WHERE e.archivado = 0`
    ).all();

    let okCount = 0, observacionCount = 0, problemaCount = 0, sinRevisionCount = 0;

    for (const { id } of equiposActivos) {
      const ultima = sqliteDb.prepare(
        `SELECT estado FROM revisiones WHERE equipo_id = ? ORDER BY creado_en DESC LIMIT 1`
      ).get(id);
      if (!ultima) sinRevisionCount++;
      else if (ultima.estado === 'ok') okCount++;
      else if (ultima.estado === 'observacion') observacionCount++;
      else if (ultima.estado === 'problema') problemaCount++;
    }

    // Revisiones de los últimos 7 días
    const hoy = new Date();
    const revisionesPorDia = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(hoy);
      d.setDate(d.getDate() - i);
      const fecha = d.toISOString().slice(0, 10);
      const { n } = sqliteDb.prepare(
        `SELECT COUNT(*) as n FROM revisiones WHERE creado_en LIKE ?`
      ).get(`${fecha}%`);
      revisionesPorDia.push({ fecha, total: n });
    }

    // Revisiones esta semana (últimos 7 días)
    const hace7 = new Date(hoy);
    hace7.setDate(hace7.getDate() - 7);
    const revisionesEstaSemana = sqliteDb.prepare(
      `SELECT COUNT(*) as n FROM revisiones WHERE creado_en >= ?`
    ).get(hace7.toISOString()).n;

    // Top 5 técnicos por revisiones realizadas
    const topTecnicos = sqliteDb.prepare(`
      SELECT t.nombre, COUNT(r.id) as total
      FROM revisiones r
      JOIN tecnicos t ON r.tecnico_id = t.id
      WHERE r.tecnico_id IS NOT NULL
      GROUP BY r.tecnico_id
      ORDER BY total DESC
      LIMIT 5
    `).all();

    // Top 5 equipos más revisados
    const topEquipos = sqliteDb.prepare(`
      SELECT e.nombre, COUNT(r.id) as total
      FROM revisiones r
      JOIN equipos e ON r.equipo_id = e.id
      GROUP BY r.equipo_id
      ORDER BY total DESC
      LIMIT 5
    `).all();

    // Últimas 8 revisiones
    const ultimasRevisiones = sqliteDb.prepare(`
      SELECT r.id, r.estado, r.creado_en, r.tecnico_nombre,
             e.nombre as equipo_nombre
      FROM revisiones r
      JOIN equipos e ON r.equipo_id = e.id
      ORDER BY r.creado_en DESC
      LIMIT 8
    `).all().map(r => ({
      id: r.id,
      estado: r.estado,
      creadoEn: r.creado_en,
      tecnicoNombre: r.tecnico_nombre,
      equipoNombre: r.equipo_nombre,
    }));

    res.json({
      success: true,
      data: {
        totales: {
          proyectos: totalProyectos,
          equiposActivos: totalEquiposActivos,
          equiposArchivados: totalEquiposArchivados,
          revisiones: totalRevisiones,
          tecnicos: totalTecnicos,
          revisionesEstaSemana,
        },
        equiposPorEstado: {
          ok: okCount,
          observacion: observacionCount,
          problema: problemaCount,
          sinRevision: sinRevisionCount,
        },
        revisionesPorDia,
        topTecnicos,
        topEquipos,
        ultimasRevisiones,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
