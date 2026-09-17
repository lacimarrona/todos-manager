const express = require('express');
const router = express.Router();
const sqliteDb = require('../db/sqlite');
const JSZip   = require('jszip');
const fs      = require('fs');
const path    = require('path');
const multer  = require('multer');

const ARCHIVOS_DIR = path.join(__dirname, '../data/archivos');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 * 1024 } });

// Escapa un valor para CSV
function csvCell(v) {
  const s = v == null ? '' : String(v);
  if (s.includes(',') || s.includes('\n') || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
function csvRow(cols) { return cols.map(csvCell).join(','); }

// GET /api/exportar/revisiones-csv?proyectoId=xxx
router.get('/revisiones-csv', (req, res) => {
  try {
    const { proyectoId } = req.query;
    let equipoIds;
    if (proyectoId) {
      equipoIds = sqliteDb.prepare('SELECT id FROM equipos WHERE proyecto_id = ?').all(proyectoId).map(r => r.id);
      if (equipoIds.length === 0) {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        return res.send('Proyecto,Equipo,Técnico,Estado,Fecha,Observación general,Item,Checked,Nota,Estado item\n');
      }
    }
    const placeholders = equipoIds ? equipoIds.map(() => '?').join(',') : null;
    const sql = equipoIds
      ? `SELECT r.*, e.nombre as equipo_nombre, p.nombre as proyecto_nombre FROM revisiones r JOIN equipos e ON r.equipo_id = e.id JOIN proyectos p ON e.proyecto_id = p.id WHERE r.equipo_id IN (${placeholders}) ORDER BY r.creado_en DESC`
      : `SELECT r.*, e.nombre as equipo_nombre, p.nombre as proyecto_nombre FROM revisiones r JOIN equipos e ON r.equipo_id = e.id JOIN proyectos p ON e.proyecto_id = p.id ORDER BY r.creado_en DESC`;

    const revisiones = equipoIds ? sqliteDb.prepare(sql).all(...equipoIds) : sqliteDb.prepare(sql).all();
    const headers = ['Proyecto', 'Equipo', 'Técnico', 'Estado revisión', 'Fecha', 'Observación general', 'Item', 'Revisado', 'Nota', 'Estado item'];
    const lines = [csvRow(headers)];

    for (const rev of revisiones) {
      let items = [];
      try { items = JSON.parse(rev.items || '[]'); } catch { items = []; }
      if (items.length === 0) {
        lines.push(csvRow([rev.proyecto_nombre, rev.equipo_nombre, rev.tecnico_nombre || '', rev.estado, rev.creado_en, rev.observacion_general || '', '', '', '', '']));
      } else {
        for (const item of items) {
          lines.push(csvRow([rev.proyecto_nombre, rev.equipo_nombre, rev.tecnico_nombre || '', rev.estado, rev.creado_en, rev.observacion_general || '', item.label || '', item.checked ? 'Sí' : 'No', item.nota || '', item.estado || '']));
        }
      }
    }

    const fileName = proyectoId ? `revisiones-proyecto-${proyectoId}.csv` : 'revisiones-todas.csv';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send('﻿' + lines.join('\r\n'));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/exportar/json — backup COMPLETO en ZIP (datos SQLite + archivos físicos)
router.get('/json', async (req, res) => {
  try {
    const backup = {
      version: '2.0',
      exportadoEn: new Date().toISOString(),
      proyectos:            sqliteDb.prepare('SELECT * FROM proyectos ORDER BY creado_en ASC').all(),
      equipos:              sqliteDb.prepare('SELECT * FROM equipos ORDER BY creado_en ASC').all(),
      plantillas:           sqliteDb.prepare('SELECT * FROM plantillas ORDER BY creado_en ASC').all(),
      revisiones:           sqliteDb.prepare('SELECT * FROM revisiones ORDER BY creado_en ASC').all(),
      tareas:               sqliteDb.prepare('SELECT * FROM tareas_programadas ORDER BY creado_en ASC').all(),
      usuarios:             sqliteDb.prepare('SELECT * FROM usuarios ORDER BY creado_en ASC').all(),
      proyectoAsignaciones: sqliteDb.prepare('SELECT * FROM proyecto_asignaciones').all(),
      proyectoPermisos:     sqliteDb.prepare('SELECT * FROM proyecto_permisos').all(),
      tecnicoSupervisores:  sqliteDb.prepare('SELECT * FROM tecnico_supervisores').all(),
      plantillaProyectos:   sqliteDb.prepare('SELECT * FROM plantilla_proyectos').all(),
      gruposElemento:       sqliteDb.prepare('SELECT * FROM grupos_elemento ORDER BY creado_en ASC').all(),
      elementosGrupo:       sqliteDb.prepare('SELECT * FROM elementos_grupo ORDER BY creado_en ASC').all(),
      usuarioPermisos:      sqliteDb.prepare('SELECT * FROM usuario_permisos').all(),
      tecnicos:             sqliteDb.prepare('SELECT * FROM tecnicos ORDER BY creado_en ASC').all(),
    };

    const zip = new JSZip();
    zip.file('backup.json', JSON.stringify(backup, null, 2));

    // Agregar archivos físicos recursivamente desde data/archivos/
    function agregarDir(dir, zipPrefix) {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        const zipEntry = zipPrefix ? `${zipPrefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          agregarDir(fullPath, zipEntry);
        } else {
          zip.file(`archivos/${zipEntry}`, fs.readFileSync(fullPath));
        }
      }
    }
    agregarDir(ARCHIVOS_DIR, '');

    const fecha = new Date().toISOString().slice(0, 10);
    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="techcheck-backup-${fecha}.zip"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/exportar/importar-json — restaura desde un backup ZIP (datos + imágenes)
// modo=agregar (default): INSERT OR IGNORE — solo agrega lo que no existe
// modo=reemplazar: INSERT OR REPLACE — sobreescribe registros existentes
router.post('/importar-json', upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Se requiere un archivo ZIP de backup' });
    }

    const zip = await JSZip.loadAsync(req.file.buffer);

    const backupFile = zip.file('backup.json');
    if (!backupFile) {
      return res.status(400).json({ success: false, message: 'ZIP inválido: no contiene backup.json' });
    }

    const data = JSON.parse(await backupFile.async('string'));
    if (!data || !data.version) {
      return res.status(400).json({ success: false, message: 'Archivo de backup inválido o sin versión' });
    }

    const modo = req.query.modo === 'reemplazar' ? 'OR REPLACE' : 'OR IGNORE';
    let importados = {
      proyectos: 0, equipos: 0, plantillas: 0, revisiones: 0, tareas: 0,
      usuarios: 0, proyectoAsignaciones: 0, proyectoPermisos: 0,
      tecnicoSupervisores: 0, plantillaProyectos: 0,
      gruposElemento: 0, elementosGrupo: 0, tecnicos: 0,
      archivos: 0,
    };

    // Usuarios
    const insUsuario = sqliteDb.prepare(
      `INSERT ${modo} INTO usuarios (id, nombre, email, password_hash, rol, activo, creado_en) VALUES (?,?,?,?,?,?,?)`
    );
    for (const u of data.usuarios || []) {
      const r = insUsuario.run(u.id, u.nombre, u.email, u.password_hash || '', u.rol || 'tecnico', u.activo ?? 1, u.creado_en);
      importados.usuarios += r.changes;
    }

    // Proyectos
    const insProyecto = sqliteDb.prepare(
      `INSERT ${modo} INTO proyectos (id, nombre, descripcion, restringido, creado_en, actualizado_en) VALUES (?,?,?,?,?,?)`
    );
    for (const p of data.proyectos || []) {
      const r = insProyecto.run(p.id, p.nombre, p.descripcion || '', p.restringido ?? 0, p.creado_en, p.actualizado_en);
      importados.proyectos += r.changes;
    }

    // Plantillas
    const insPlantilla = sqliteDb.prepare(
      `INSERT ${modo} INTO plantillas (id, nombre, descripcion, items, creado_por, creado_en, actualizado_en) VALUES (?,?,?,?,?,?,?)`
    );
    for (const p of data.plantillas || []) {
      const r = insPlantilla.run(p.id, p.nombre, p.descripcion || '', p.items, p.creado_por ?? null, p.creado_en, p.actualizado_en);
      importados.plantillas += r.changes;
    }

    // Equipos
    const insEquipo = sqliteDb.prepare(
      `INSERT ${modo} INTO equipos (id, proyecto_id, nombre, descripcion, items, plantilla_id, tecnico_asignado_id, archivado, creado_en, actualizado_en) VALUES (?,?,?,?,?,?,?,?,?,?)`
    );
    for (const e of data.equipos || []) {
      const r = insEquipo.run(e.id, e.proyecto_id, e.nombre, e.descripcion || '', e.items, e.plantilla_id ?? null, e.tecnico_asignado_id ?? null, e.archivado ?? 0, e.creado_en, e.actualizado_en);
      importados.equipos += r.changes;
    }

    // Revisiones
    const insRevision = sqliteDb.prepare(
      `INSERT ${modo} INTO revisiones (id, equipo_id, tecnico_id, tecnico_nombre, estado, items, observacion_general, fotos, creado_en, actualizado_en) VALUES (?,?,?,?,?,?,?,?,?,?)`
    );
    for (const r of data.revisiones || []) {
      const res2 = insRevision.run(r.id, r.equipo_id, r.tecnico_id ?? null, r.tecnico_nombre ?? '', r.estado, r.items, r.observacion_general ?? '', r.fotos ?? '[]', r.creado_en, r.actualizado_en);
      importados.revisiones += res2.changes;
    }

    // Tareas programadas
    const insTarea = sqliteDb.prepare(
      `INSERT ${modo} INTO tareas_programadas (id, equipo_id, tecnico_id, hora, dias_semana, activa, fecha_fin, creado_en) VALUES (?,?,?,?,?,?,?,?)`
    );
    for (const t of data.tareas || []) {
      const r = insTarea.run(t.id, t.equipo_id, t.tecnico_id ?? null, t.hora, t.dias_semana, t.activa ?? 1, t.fecha_fin ?? null, t.creado_en);
      importados.tareas += r.changes;
    }

    // Relaciones
    const insPA = sqliteDb.prepare(`INSERT ${modo} INTO proyecto_asignaciones (proyecto_id, usuario_id) VALUES (?,?)`);
    for (const pa of data.proyectoAsignaciones || []) {
      const r = insPA.run(pa.proyecto_id, pa.usuario_id); importados.proyectoAsignaciones += r.changes;
    }

    const insPP = sqliteDb.prepare(`INSERT ${modo} INTO proyecto_permisos (proyecto_id, tecnico_id, nivel) VALUES (?,?,?)`);
    for (const pp of data.proyectoPermisos || []) {
      const r = insPP.run(pp.proyecto_id, pp.tecnico_id, pp.nivel || 'ver'); importados.proyectoPermisos += r.changes;
    }

    const insTS = sqliteDb.prepare(`INSERT ${modo} INTO tecnico_supervisores (tecnico_id, supervisor_id) VALUES (?,?)`);
    for (const ts of data.tecnicoSupervisores || []) {
      const r = insTS.run(ts.tecnico_id, ts.supervisor_id); importados.tecnicoSupervisores += r.changes;
    }

    const insPlPr = sqliteDb.prepare(`INSERT ${modo} INTO plantilla_proyectos (plantilla_id, proyecto_id) VALUES (?,?)`);
    for (const pp of data.plantillaProyectos || []) {
      const r = insPlPr.run(pp.plantilla_id, pp.proyecto_id); importados.plantillaProyectos += r.changes;
    }

    // Permisos especiales
    const insUP = sqliteDb.prepare(`INSERT ${modo} INTO usuario_permisos (usuario_id, permiso) VALUES (?,?)`);
    for (const up of data.usuarioPermisos || []) {
      insUP.run(up.usuario_id, up.permiso);
    }

    // Catálogos
    const insGrupo = sqliteDb.prepare(
      `INSERT ${modo} INTO grupos_elemento (id, nombre, descripcion, activo, creado_en) VALUES (?,?,?,?,?)`
    );
    for (const g of data.gruposElemento || []) {
      const r = insGrupo.run(g.id, g.nombre, g.descripcion || '', g.activo ?? 1, g.creado_en);
      importados.gruposElemento += r.changes;
    }

    const insElem = sqliteDb.prepare(
      `INSERT ${modo} INTO elementos_grupo (id, grupo_id, valor, descripcion, activo, creado_en) VALUES (?,?,?,?,?,?)`
    );
    for (const e of data.elementosGrupo || []) {
      const r = insElem.run(e.id, e.grupo_id, e.valor, e.descripcion || '', e.activo ?? 1, e.creado_en);
      importados.elementosGrupo += r.changes;
    }

    // Legado: técnicos tabla antigua
    const insTec = sqliteDb.prepare(`INSERT ${modo} INTO tecnicos (id, nombre, email, creado_en) VALUES (?,?,?,?)`);
    for (const t of data.tecnicos || []) {
      const r = insTec.run(t.id, t.nombre, t.email || '', t.creado_en); importados.tecnicos += r.changes;
    }

    // Restaurar archivos físicos desde archivos/ del ZIP
    const INDEX_PATH = path.join(ARCHIVOS_DIR, 'index.json');
    let indexLocal = {};
    try { indexLocal = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8')); } catch { indexLocal = {}; }

    let indexZip = {};
    const indexZipFile = zip.file('archivos/index.json');
    if (indexZipFile) {
      try { indexZip = JSON.parse(await indexZipFile.async('string')); } catch { indexZip = {}; }
    }

    const archivosZip = [];
    zip.forEach((relPath, file) => {
      if (!file.dir && relPath.startsWith('archivos/') && relPath !== 'archivos/index.json') {
        archivosZip.push({ relPath, file });
      }
    });

    for (const { relPath, file } of archivosZip) {
      const subPath = relPath.slice('archivos/'.length);
      const destPath = path.join(ARCHIVOS_DIR, subPath);
      const destDir = path.dirname(destPath);
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
      if (!fs.existsSync(destPath)) {
        const buf = await file.async('nodebuffer');
        fs.writeFileSync(destPath, buf);
        importados.archivos++;
      }
    }

    // Mergear index.json: agregar entradas del ZIP que no existan localmente
    const indexMergeado = { ...indexZip, ...indexLocal };
    fs.mkdirSync(ARCHIVOS_DIR, { recursive: true });
    fs.writeFileSync(INDEX_PATH, JSON.stringify(indexMergeado, null, 2));

    res.json({ success: true, data: importados, modo });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
