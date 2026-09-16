/**
 * Migración única JSON → SQLite.
 * Se ejecuta al arrancar si la tabla proyectos está vacía.
 * Lee los archivos JSON legacy y los inserta en SQLite.
 */
const fs = require('fs');
const path = require('path');
const db = require('./sqlite');

const GLOBAL_PATH = path.join(__dirname, '../data/global.json');
const PROYECTOS_DIR = path.join(__dirname, '../data/proyectos');

function migrar() {
  const count = db.prepare('SELECT COUNT(*) as n FROM proyectos').get().n;
  if (count > 0) return; // ya migrado

  console.log('[migrate] Base de datos vacía — iniciando migración desde JSON...');

  if (!fs.existsSync(GLOBAL_PATH)) {
    console.log('[migrate] No hay datos JSON que migrar. DB lista.');
    return;
  }

  let global;
  try {
    global = JSON.parse(fs.readFileSync(GLOBAL_PATH, 'utf-8'));
  } catch (e) {
    console.warn('[migrate] No se pudo leer global.json:', e.message);
    return;
  }

  const insertProyecto = db.prepare(
    'INSERT OR IGNORE INTO proyectos (id, nombre, descripcion, creado_en, actualizado_en) VALUES (?,?,?,?,?)'
  );
  const insertTecnico = db.prepare(
    'INSERT OR IGNORE INTO tecnicos (id, nombre, email, creado_en) VALUES (?,?,?,?)'
  );
  const insertPlantilla = db.prepare(
    'INSERT OR IGNORE INTO plantillas (id, nombre, descripcion, items, creado_en, actualizado_en) VALUES (?,?,?,?,?,?)'
  );
  const insertEquipo = db.prepare(
    `INSERT OR IGNORE INTO equipos
     (id, nombre, descripcion, items, proyecto_id, plantilla_id, tecnico_asignado_id, archivado, creado_en, actualizado_en)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  );
  const insertRevision = db.prepare(
    `INSERT OR IGNORE INTO revisiones
     (id, equipo_id, tecnico_id, tecnico_nombre, estado, items, observacion_general, fotos, creado_en, actualizado_en)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  );

  db.exec('BEGIN');
  try {
    // Proyectos
    for (const p of (global.proyectos || [])) {
      insertProyecto.run(
        p.id, p.nombre, p.descripcion || '',
        p.creadoEn || new Date().toISOString(),
        p.actualizadoEn || new Date().toISOString()
      );

      // Equipos y revisiones del proyecto
      const pPath = path.join(PROYECTOS_DIR, `${p.id}.json`);
      if (!fs.existsSync(pPath)) continue;
      let pData;
      try { pData = JSON.parse(fs.readFileSync(pPath, 'utf-8')); } catch { continue; }

      for (const e of (pData.equipos || [])) {
        const proyectoId = Array.isArray(e.proyectoIds) ? e.proyectoIds[0] : p.id;
        insertEquipo.run(
          e.id, e.nombre, e.descripcion || '',
          JSON.stringify(e.items || []),
          proyectoId,
          e.plantillaId || null,
          e.tecnicoAsignadoId || null,
          e.archivado ? 1 : 0,
          e.creadoEn || new Date().toISOString(),
          e.actualizadoEn || new Date().toISOString()
        );
      }

      for (const r of (pData.revisiones || [])) {
        insertRevision.run(
          r.id, r.equipoId,
          r.tecnicoId || null,
          r.tecnicoNombre || '',
          r.estado || 'ok',
          JSON.stringify(r.items || []),
          r.observacionGeneral || '',
          JSON.stringify(r.fotos || []),
          r.creadoEn || new Date().toISOString(),
          r.actualizadoEn || new Date().toISOString()
        );
      }
    }

    // Técnicos
    for (const t of (global.tecnicos || [])) {
      insertTecnico.run(
        t.id, t.nombre, t.email || '',
        t.creadoEn || new Date().toISOString()
      );
    }

    // Plantillas
    for (const pl of (global.plantillas || [])) {
      insertPlantilla.run(
        pl.id, pl.nombre, pl.descripcion || '',
        JSON.stringify(pl.items || []),
        pl.creadoEn || new Date().toISOString(),
        pl.actualizadoEn || new Date().toISOString()
      );
    }

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  const totales = {
    proyectos: db.prepare('SELECT COUNT(*) as n FROM proyectos').get().n,
    tecnicos:  db.prepare('SELECT COUNT(*) as n FROM tecnicos').get().n,
    plantillas:db.prepare('SELECT COUNT(*) as n FROM plantillas').get().n,
    equipos:   db.prepare('SELECT COUNT(*) as n FROM equipos').get().n,
    revisiones:db.prepare('SELECT COUNT(*) as n FROM revisiones').get().n,
  };
  console.log('[migrate] Migración completada:', totales);
}

module.exports = { migrar };
