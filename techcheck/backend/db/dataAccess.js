const { v4: uuidv4 } = require('uuid');
const db = require('./sqlite');

// ─── helpers ────────────────────────────────────────────────────────────────
const now = () => new Date().toISOString();
const J  = (v) => JSON.stringify(v ?? []);
const P  = (v) => { try { return JSON.parse(v); } catch { return v; } };

function rowToProyecto(r) {
  if (!r) return null;
  return { id: r.id, nombre: r.nombre, descripcion: r.descripcion, creadoEn: r.creado_en, actualizadoEn: r.actualizado_en };
}

function rowToTecnico(r) {
  if (!r) return null;
  return { id: r.id, nombre: r.nombre, email: r.email, creadoEn: r.creado_en };
}

function rowToPlantilla(r) {
  if (!r) return null;
  return { id: r.id, nombre: r.nombre, descripcion: r.descripcion, items: P(r.items), creadoEn: r.creado_en, actualizadoEn: r.actualizado_en };
}

function rowToEquipo(r) {
  if (!r) return null;
  return {
    id: r.id, nombre: r.nombre, descripcion: r.descripcion,
    items: P(r.items),
    proyectoIds: [r.proyecto_id],
    plantillaId: r.plantilla_id || null,
    tecnicoAsignadoId: r.tecnico_asignado_id || null,
    archivado: r.archivado === 1,
    creadoEn: r.creado_en, actualizadoEn: r.actualizado_en,
  };
}

function rowToRevision(r) {
  if (!r) return null;
  return {
    id: r.id, equipoId: r.equipo_id,
    tecnicoId: r.tecnico_id || null,
    tecnicoNombre: r.tecnico_nombre || '',
    estado: r.estado,
    items: P(r.items),
    observacionGeneral: r.observacion_general || '',
    fotos: P(r.fotos),
    creadoEn: r.creado_en, actualizadoEn: r.actualizado_en,
  };
}

// ─── PROYECTOS ───────────────────────────────────────────────────────────────
function getProyectos() {
  return db.prepare('SELECT * FROM proyectos ORDER BY creado_en ASC').all().map(rowToProyecto);
}

function getProyectoById(id) {
  return rowToProyecto(db.prepare('SELECT * FROM proyectos WHERE id = ?').get(id));
}

function createProyecto(proyecto) {
  db.prepare(
    'INSERT INTO proyectos (id, nombre, descripcion, creado_en, actualizado_en) VALUES (?,?,?,?,?)'
  ).run(proyecto.id, proyecto.nombre, proyecto.descripcion || '', proyecto.creadoEn || now(), proyecto.actualizadoEn || now());
  return getProyectoById(proyecto.id);
}

function updateProyecto(id, datos) {
  const p = getProyectoById(id);
  if (!p) return null;
  const nombre = datos.nombre ?? p.nombre;
  const descripcion = datos.descripcion ?? p.descripcion;
  db.prepare('UPDATE proyectos SET nombre=?, descripcion=?, actualizado_en=? WHERE id=?')
    .run(nombre, descripcion, now(), id);
  return getProyectoById(id);
}

function deleteProyecto(id) {
  // ON DELETE CASCADE borra equipos; revisiones quedan huérfanas: las eliminamos manualmente
  const equipos = db.prepare('SELECT id FROM equipos WHERE proyecto_id = ?').all(id);
  const equipoIds = equipos.map(e => e.id);
  if (equipoIds.length) {
    const ph = equipoIds.map(() => '?').join(',');
    db.prepare(`DELETE FROM revisiones WHERE equipo_id IN (${ph})`).run(...equipoIds);
  }
  const info = db.prepare('DELETE FROM proyectos WHERE id = ?').run(id);
  return info.changes > 0;
}

// ─── EQUIPOS ─────────────────────────────────────────────────────────────────
function getEquipos() {
  return db.prepare('SELECT * FROM equipos ORDER BY creado_en ASC').all().map(rowToEquipo);
}

function getEquipoById(id) {
  return rowToEquipo(db.prepare('SELECT * FROM equipos WHERE id = ?').get(id));
}

function getEquiposByProyecto(proyectoId) {
  return db.prepare('SELECT * FROM equipos WHERE proyecto_id = ? ORDER BY creado_en ASC').all(proyectoId).map(rowToEquipo);
}

function createEquipo(equipo) {
  const proyectoId = Array.isArray(equipo.proyectoIds) ? equipo.proyectoIds[0] : equipo.proyectoId;
  db.prepare(
    `INSERT INTO equipos (id, nombre, descripcion, items, proyecto_id, plantilla_id, tecnico_asignado_id, archivado, creado_en, actualizado_en)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(
    equipo.id, equipo.nombre, equipo.descripcion || '',
    J(equipo.items), proyectoId,
    equipo.plantillaId || null,
    equipo.tecnicoAsignadoId || null,
    equipo.archivado ? 1 : 0,
    equipo.creadoEn || now(), equipo.actualizadoEn || now()
  );
  return getEquipoById(equipo.id);
}

function updateEquipo(id, datos) {
  const e = getEquipoById(id);
  if (!e) return null;
  const fields = [];
  const vals = [];

  if (datos.nombre !== undefined)             { fields.push('nombre=?');                vals.push(datos.nombre); }
  if (datos.descripcion !== undefined)        { fields.push('descripcion=?');           vals.push(datos.descripcion); }
  if (datos.items !== undefined)              { fields.push('items=?');                 vals.push(J(datos.items)); }
  if (datos.plantillaId !== undefined)        { fields.push('plantilla_id=?');          vals.push(datos.plantillaId); }
  if (datos.tecnicoAsignadoId !== undefined)  { fields.push('tecnico_asignado_id=?');   vals.push(datos.tecnicoAsignadoId); }
  if (datos.archivado !== undefined)          { fields.push('archivado=?');             vals.push(datos.archivado ? 1 : 0); }

  if (fields.length === 0) return e;
  fields.push('actualizado_en=?');
  vals.push(now(), id);
  db.prepare(`UPDATE equipos SET ${fields.join(', ')} WHERE id=?`).run(...vals);
  return getEquipoById(id);
}

function deleteEquipo(id) {
  db.prepare('DELETE FROM revisiones WHERE equipo_id = ?').run(id);
  const info = db.prepare('DELETE FROM equipos WHERE id = ?').run(id);
  return info.changes > 0;
}

// ─── REVISIONES ──────────────────────────────────────────────────────────────
function getRevisiones(filtros = {}) {
  let sql = 'SELECT * FROM revisiones WHERE 1=1';
  const vals = [];
  if (filtros.equipoId) { sql += ' AND equipo_id = ?'; vals.push(filtros.equipoId); }
  if (filtros.tecnicoId) { sql += ' AND tecnico_id = ?'; vals.push(filtros.tecnicoId); }
  if (filtros.estado) { sql += ' AND estado = ?'; vals.push(filtros.estado); }
  sql += ' ORDER BY creado_en DESC';
  return db.prepare(sql).all(...vals).map(rowToRevision);
}

function getRevisionesByProyecto(proyectoId) {
  const equipoIds = db.prepare('SELECT id FROM equipos WHERE proyecto_id = ?').all(proyectoId).map(e => e.id);
  if (!equipoIds.length) return [];
  const ph = equipoIds.map(() => '?').join(',');
  return db.prepare(`SELECT * FROM revisiones WHERE equipo_id IN (${ph}) ORDER BY creado_en DESC`).all(...equipoIds).map(rowToRevision);
}

function getRevisionById(id) {
  return rowToRevision(db.prepare('SELECT * FROM revisiones WHERE id = ?').get(id));
}

function createRevision(revision) {
  db.prepare(
    `INSERT INTO revisiones (id, equipo_id, tecnico_id, tecnico_nombre, estado, items, observacion_general, fotos, creado_en, actualizado_en)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(
    revision.id, revision.equipoId,
    revision.tecnicoId || null,
    revision.tecnicoNombre || '',
    revision.estado,
    J(revision.items),
    revision.observacionGeneral || '',
    J(revision.fotos),
    revision.creadoEn || now(), revision.actualizadoEn || now()
  );
  return getRevisionById(revision.id);
}

function updateRevision(id, datos) {
  const r = getRevisionById(id);
  if (!r) return null;
  const fields = [];
  const vals = [];

  if (datos.estado !== undefined)              { fields.push('estado=?');               vals.push(datos.estado); }
  if (datos.items !== undefined)               { fields.push('items=?');                vals.push(J(datos.items)); }
  if (datos.observacionGeneral !== undefined)  { fields.push('observacion_general=?');  vals.push(datos.observacionGeneral); }
  if (datos.fotos !== undefined)               { fields.push('fotos=?');                vals.push(J(datos.fotos)); }
  if (datos.tecnicoId !== undefined)           { fields.push('tecnico_id=?');           vals.push(datos.tecnicoId); }
  if (datos.tecnicoNombre !== undefined)       { fields.push('tecnico_nombre=?');       vals.push(datos.tecnicoNombre); }

  if (fields.length === 0) return r;
  fields.push('actualizado_en=?');
  vals.push(now(), id);
  db.prepare(`UPDATE revisiones SET ${fields.join(', ')} WHERE id=?`).run(...vals);
  return getRevisionById(id);
}

function deleteRevision(id) {
  const info = db.prepare('DELETE FROM revisiones WHERE id = ?').run(id);
  return info.changes > 0;
}

// ─── PLANTILLAS ──────────────────────────────────────────────────────────────
function getPlantillas() {
  return db.prepare('SELECT * FROM plantillas ORDER BY creado_en ASC').all().map(rowToPlantilla);
}

function getPlantillaById(id) {
  return rowToPlantilla(db.prepare('SELECT * FROM plantillas WHERE id = ?').get(id));
}

function createPlantilla(plantilla) {
  db.prepare(
    'INSERT INTO plantillas (id, nombre, descripcion, items, creado_en, actualizado_en) VALUES (?,?,?,?,?,?)'
  ).run(plantilla.id, plantilla.nombre, plantilla.descripcion || '', J(plantilla.items), plantilla.creadoEn || now(), plantilla.actualizadoEn || now());
  return getPlantillaById(plantilla.id);
}

function updatePlantilla(id, datos) {
  const p = getPlantillaById(id);
  if (!p) return null;
  const fields = [];
  const vals = [];
  if (datos.nombre !== undefined)      { fields.push('nombre=?');      vals.push(datos.nombre); }
  if (datos.descripcion !== undefined) { fields.push('descripcion=?'); vals.push(datos.descripcion); }
  if (datos.items !== undefined)       { fields.push('items=?');       vals.push(J(datos.items)); }
  if (fields.length === 0) return p;
  fields.push('actualizado_en=?');
  vals.push(now(), id);
  db.prepare(`UPDATE plantillas SET ${fields.join(', ')} WHERE id=?`).run(...vals);
  return getPlantillaById(id);
}

function deletePlantilla(id) {
  const info = db.prepare('DELETE FROM plantillas WHERE id = ?').run(id);
  return info.changes > 0;
}

// ─── TÉCNICOS ────────────────────────────────────────────────────────────────
function getTecnicos() {
  return db.prepare('SELECT * FROM tecnicos ORDER BY creado_en ASC').all().map(rowToTecnico);
}

function getTecnicoById(id) {
  return rowToTecnico(db.prepare('SELECT * FROM tecnicos WHERE id = ?').get(id));
}

function createTecnico(tecnico) {
  db.prepare('INSERT INTO tecnicos (id, nombre, email, creado_en) VALUES (?,?,?,?)')
    .run(tecnico.id, tecnico.nombre, tecnico.email || '', tecnico.creadoEn || now());
  return getTecnicoById(tecnico.id);
}

function updateTecnico(id, datos) {
  const t = getTecnicoById(id);
  if (!t) return null;
  const nombre = datos.nombre ?? t.nombre;
  const email  = datos.email  ?? t.email;
  db.prepare('UPDATE tecnicos SET nombre=?, email=? WHERE id=?').run(nombre, email, id);
  return getTecnicoById(id);
}

function deleteTecnico(id) {
  const info = db.prepare('DELETE FROM tecnicos WHERE id = ?').run(id);
  return info.changes > 0;
}

// ─── EXPORTAR / IMPORTAR PROYECTO ────────────────────────────────────────────
function collectArchivoHashes(val, subpaths = new Set()) {
  if (Array.isArray(val)) { val.forEach(item => collectArchivoHashes(item, subpaths)); }
  else if (val && typeof val === 'object') {
    if (typeof val.url === 'string' && val.url.startsWith('/api/archivos/')) {
      subpaths.add(val.url.replace('/api/archivos/', ''));
    }
    Object.values(val).forEach(v => collectArchivoHashes(v, subpaths));
  }
  return subpaths;
}

function exportarProyecto(proyectoId) {
  const proyecto = getProyectoById(proyectoId);
  if (!proyecto) return null;
  const equipos = getEquiposByProyecto(proyectoId);
  const revisiones = getRevisionesByProyecto(proyectoId);
  const tecnicos = getTecnicos();
  return { proyecto, equipos, revisiones, tecnicos };
}

function importarProyecto(datos) {
  const { proyecto, equipos, revisiones, tecnicos } = datos;
  const nuevoId = uuidv4();
  const nuevo = {
    id: nuevoId, nombre: proyecto.nombre, descripcion: proyecto.descripcion || '',
    creadoEn: now(), actualizadoEn: now(),
  };
  createProyecto(nuevo);

  const tecnicosExistentes = getTecnicos().map(t => t.email);
  for (const t of (tecnicos || [])) {
    if (!tecnicosExistentes.includes(t.email)) {
      createTecnico({ ...t, id: uuidv4(), creadoEn: now() });
      tecnicosExistentes.push(t.email);
    }
  }

  for (const e of (equipos || [])) {
    createEquipo({ ...e, id: uuidv4(), proyectoIds: [nuevoId], creadoEn: now(), actualizadoEn: now() });
  }

  return nuevo;
}

// ─── Compatibilidad legado: acceso directo (usado en pocas rutas) ─────────────
function readGlobal() {
  return {
    proyectos: getProyectos(),
    tecnicos: getTecnicos(),
    plantillas: getPlantillas(),
  };
}

function writeGlobal() { /* no-op — datos en SQLite */ }

function readProyectoData(proyectoId) {
  return {
    equipos: getEquiposByProyecto(proyectoId),
    revisiones: getRevisionesByProyecto(proyectoId),
  };
}

function writeProyectoData() { /* no-op */ }

// ── Tareas programadas ─────────────────────────────────────────
function rowToTarea(r) {
  const equipo = getEquipoById(r.equipo_id);
  const tecnico = r.tecnico_id ? getTecnicoById(r.tecnico_id) : null;
  return {
    id: r.id,
    equipoId: r.equipo_id,
    equipoNombre: equipo?.nombre || '',
    tecnicoId: r.tecnico_id || null,
    tecnicoNombre: tecnico?.nombre || '',
    hora: r.hora,
    diasSemana: P(r.dias_semana),
    activa: r.activa === 1,
    fechaFin: r.fecha_fin || null,
    creadoEn: r.creado_en,
  };
}

function getTareas() {
  return db.prepare('SELECT * FROM tareas_programadas ORDER BY creado_en DESC').all().map(rowToTarea);
}

function getTareaById(id) {
  const r = db.prepare('SELECT * FROM tareas_programadas WHERE id = ?').get(id);
  return r ? rowToTarea(r) : null;
}

function getTareasActivas() {
  return db.prepare('SELECT * FROM tareas_programadas WHERE activa = 1').all().map(rowToTarea);
}

function createTarea(data) {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO tareas_programadas (id, equipo_id, tecnico_id, hora, dias_semana, activa, fecha_fin, creado_en)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(
    data.id, data.equipoId, data.tecnicoId || null,
    data.hora, J(data.diasSemana || []),
    data.activa !== false ? 1 : 0,
    data.fechaFin || null, now
  );
  return getTareaById(data.id);
}

function updateTarea(id, patch) {
  const campos = [];
  const vals = [];
  if (patch.hora !== undefined) { campos.push('hora = ?'); vals.push(patch.hora); }
  if (patch.diasSemana !== undefined) { campos.push('dias_semana = ?'); vals.push(J(patch.diasSemana)); }
  if (patch.tecnicoId !== undefined) { campos.push('tecnico_id = ?'); vals.push(patch.tecnicoId || null); }
  if (patch.activa !== undefined) { campos.push('activa = ?'); vals.push(patch.activa ? 1 : 0); }
  if (patch.fechaFin !== undefined) { campos.push('fecha_fin = ?'); vals.push(patch.fechaFin || null); }
  if (!campos.length) return getTareaById(id);
  vals.push(id);
  db.prepare(`UPDATE tareas_programadas SET ${campos.join(', ')} WHERE id = ?`).run(...vals);
  return getTareaById(id);
}

function deleteTarea(id) {
  const tarea = getTareaById(id);
  if (!tarea) return false;
  db.prepare('DELETE FROM tareas_programadas WHERE id = ?').run(id);
  return true;
}

module.exports = {
  getProyectos, getProyectoById, createProyecto, updateProyecto, deleteProyecto,
  getEquipos, getEquipoById, getEquiposByProyecto, createEquipo, updateEquipo, deleteEquipo,
  getPlantillas, getPlantillaById, createPlantilla, updatePlantilla, deletePlantilla,
  getTecnicos, getTecnicoById, createTecnico, updateTecnico, deleteTecnico,
  getRevisiones, getRevisionesByProyecto, getRevisionById, createRevision, updateRevision, deleteRevision,
  exportarProyecto, importarProyecto, collectArchivoHashes,
  readGlobal, writeGlobal, readProyectoData, writeProyectoData,
  getTareas, getTareaById, getTareasActivas, createTarea, updateTarea, deleteTarea,
};
