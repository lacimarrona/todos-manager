const express = require('express');
const router = express.Router();
const sqliteDb = require('../db/sqlite');

// Escapa un valor para CSV (comillas dobles si contiene coma/salto/comilla)
function csvCell(v) {
  const s = v == null ? '' : String(v);
  if (s.includes(',') || s.includes('\n') || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(cols) {
  return cols.map(csvCell).join(',');
}

// GET /api/exportar/revisiones-csv?proyectoId=xxx
// Exporta revisiones en CSV. Si proyectoId se omite, exporta todo.
router.get('/revisiones-csv', (req, res) => {
  try {
    const { proyectoId } = req.query;

    let equipoIds;
    if (proyectoId) {
      equipoIds = sqliteDb.prepare(
        'SELECT id FROM equipos WHERE proyecto_id = ?'
      ).all(proyectoId).map(r => r.id);
      if (equipoIds.length === 0) {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        return res.send('Proyecto,Equipo,Técnico,Estado,Fecha,Observación general,Item,Checked,Nota,Estado item\n');
      }
    }

    // Filas base de revisiones
    const placeholders = equipoIds ? equipoIds.map(() => '?').join(',') : null;
    const sql = equipoIds
      ? `SELECT r.*, e.nombre as equipo_nombre, p.nombre as proyecto_nombre
         FROM revisiones r
         JOIN equipos e ON r.equipo_id = e.id
         JOIN proyectos p ON e.proyecto_id = p.id
         WHERE r.equipo_id IN (${placeholders})
         ORDER BY r.creado_en DESC`
      : `SELECT r.*, e.nombre as equipo_nombre, p.nombre as proyecto_nombre
         FROM revisiones r
         JOIN equipos e ON r.equipo_id = e.id
         JOIN proyectos p ON e.proyecto_id = p.id
         ORDER BY r.creado_en DESC`;

    const revisiones = equipoIds
      ? sqliteDb.prepare(sql).all(...equipoIds)
      : sqliteDb.prepare(sql).all();

    const headers = ['Proyecto', 'Equipo', 'Técnico', 'Estado revisión', 'Fecha', 'Observación general', 'Item', 'Revisado', 'Nota', 'Estado item'];
    const lines = [csvRow(headers)];

    for (const rev of revisiones) {
      let items = [];
      try { items = JSON.parse(rev.items || '[]'); } catch { items = []; }

      if (items.length === 0) {
        lines.push(csvRow([
          rev.proyecto_nombre, rev.equipo_nombre, rev.tecnico_nombre || '',
          rev.estado, rev.creado_en, rev.observacion_general || '',
          '', '', '', ''
        ]));
      } else {
        for (const item of items) {
          lines.push(csvRow([
            rev.proyecto_nombre, rev.equipo_nombre, rev.tecnico_nombre || '',
            rev.estado, rev.creado_en, rev.observacion_general || '',
            item.label || '', item.checked ? 'Sí' : 'No', item.nota || '', item.estado || ''
          ]));
        }
      }
    }

    const fileName = proyectoId ? `revisiones-proyecto-${proyectoId}.csv` : 'revisiones-todas.csv';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send('﻿' + lines.join('\r\n')); // BOM para Excel
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/exportar/json
// Exporta un JSON completo: proyectos, equipos, plantillas, técnicos, revisiones
router.get('/json', (req, res) => {
  try {
    const proyectos  = sqliteDb.prepare('SELECT * FROM proyectos ORDER BY creado_en ASC').all();
    const equipos    = sqliteDb.prepare('SELECT * FROM equipos ORDER BY creado_en ASC').all();
    const plantillas = sqliteDb.prepare('SELECT * FROM plantillas ORDER BY creado_en ASC').all();
    const tecnicos   = sqliteDb.prepare('SELECT * FROM tecnicos ORDER BY creado_en ASC').all();
    const revisiones = sqliteDb.prepare('SELECT * FROM revisiones ORDER BY creado_en ASC').all();
    const tareas     = sqliteDb.prepare('SELECT * FROM tareas_programadas ORDER BY creado_en ASC').all();

    const backup = {
      version: '1.0',
      exportadoEn: new Date().toISOString(),
      proyectos, equipos, plantillas, tecnicos, revisiones, tareas,
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="techcheck-backup-${new Date().toISOString().slice(0,10)}.json"`);
    res.json(backup);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/exportar/importar-json
// Importa un backup JSON. Solo inserta registros que no existan (por id).
router.post('/importar-json', express.json({ limit: '50mb' }), (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.version) {
      return res.status(400).json({ success: false, message: 'Archivo JSON inválido' });
    }

    let importados = { proyectos: 0, equipos: 0, plantillas: 0, tecnicos: 0, revisiones: 0, tareas: 0 };

    const insertProyecto = sqliteDb.prepare(
      `INSERT OR IGNORE INTO proyectos (id, nombre, descripcion, creado_en, actualizado_en) VALUES (?,?,?,?,?)`
    );
    for (const p of data.proyectos || []) {
      const r = insertProyecto.run(p.id, p.nombre, p.descripcion, p.creado_en, p.actualizado_en);
      importados.proyectos += r.changes;
    }

    const insertEquipo = sqliteDb.prepare(
      `INSERT OR IGNORE INTO equipos (id, proyecto_id, nombre, descripcion, items, plantilla_id, tecnico_asignado_id, archivado, creado_en, actualizado_en) VALUES (?,?,?,?,?,?,?,?,?,?)`
    );
    for (const e of data.equipos || []) {
      const r = insertEquipo.run(e.id, e.proyecto_id, e.nombre, e.descripcion, e.items, e.plantilla_id ?? null, e.tecnico_asignado_id ?? null, e.archivado ?? 0, e.creado_en, e.actualizado_en);
      importados.equipos += r.changes;
    }

    const insertPlantilla = sqliteDb.prepare(
      `INSERT OR IGNORE INTO plantillas (id, nombre, descripcion, items, creado_en, actualizado_en) VALUES (?,?,?,?,?,?)`
    );
    for (const p of data.plantillas || []) {
      const r = insertPlantilla.run(p.id, p.nombre, p.descripcion, p.items, p.creado_en, p.actualizado_en);
      importados.plantillas += r.changes;
    }

    const insertTecnico = sqliteDb.prepare(
      `INSERT OR IGNORE INTO tecnicos (id, nombre, email, creado_en) VALUES (?,?,?,?)`
    );
    for (const t of data.tecnicos || []) {
      const r = insertTecnico.run(t.id, t.nombre, t.email, t.creado_en);
      importados.tecnicos += r.changes;
    }

    const insertRevision = sqliteDb.prepare(
      `INSERT OR IGNORE INTO revisiones (id, equipo_id, tecnico_id, tecnico_nombre, estado, items, observacion_general, fotos, creado_en, actualizado_en) VALUES (?,?,?,?,?,?,?,?,?,?)`
    );
    for (const r of data.revisiones || []) {
      const res2 = insertRevision.run(r.id, r.equipo_id, r.tecnico_id ?? null, r.tecnico_nombre ?? '', r.estado, r.items, r.observacion_general ?? '', r.fotos ?? '[]', r.creado_en, r.actualizado_en);
      importados.revisiones += res2.changes;
    }

    const insertTarea = sqliteDb.prepare(
      `INSERT OR IGNORE INTO tareas_programadas (id, equipo_id, tecnico_id, hora, dias_semana, activa, fecha_fin, creado_en) VALUES (?,?,?,?,?,?,?,?)`
    );
    for (const t of data.tareas || []) {
      const r = insertTarea.run(t.id, t.equipo_id, t.tecnico_id ?? null, t.hora, t.dias_semana, t.activa ?? 1, t.fecha_fin ?? null, t.creado_en);
      importados.tareas += r.changes;
    }

    res.json({ success: true, data: importados });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
