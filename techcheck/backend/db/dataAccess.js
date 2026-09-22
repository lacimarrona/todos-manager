const { v4: uuidv4 } = require('uuid');
const db = require('./sqlite');

// ─── helpers ────────────────────────────────────────────────────────────────
const now = () => new Date().toISOString();
const J  = (v) => JSON.stringify(v ?? []);
const P  = (v) => { try { return JSON.parse(v); } catch { return v; } };

function rowToProyecto(r) {
  if (!r) return null;
  return { id: r.id, nombre: r.nombre, descripcion: r.descripcion, restringido: r.restringido === 1, creadoEn: r.creado_en, actualizadoEn: r.actualizado_en };
}

function rowToTecnico(r) {
  if (!r) return null;
  return { id: r.id, nombre: r.nombre, email: r.email || '', creadoEn: r.creado_en };
}

function rowToUsuario(r) {
  if (!r) return null;
  return {
    id: r.id, nombre: r.nombre, email: r.email,
    username: r.username || r.email || '',
    passwordHash: r.password_hash,
    rol: r.rol, activo: r.activo === 1,
    creadoEn: r.creado_en,
  };
}

function rowToPlantilla(r) {
  if (!r) return null;
  return { id: r.id, nombre: r.nombre, descripcion: r.descripcion, items: P(r.items), creadoPor: r.creado_por || null, creadoEn: r.creado_en, actualizadoEn: r.actualizado_en };
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
    'INSERT INTO plantillas (id, nombre, descripcion, items, creado_por, creado_en, actualizado_en) VALUES (?,?,?,?,?,?,?)'
  ).run(plantilla.id, plantilla.nombre, plantilla.descripcion || '', J(plantilla.items), plantilla.creadoPor || null, plantilla.creadoEn || now(), plantilla.actualizadoEn || now());
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

// ─── TÉCNICOS (alias de usuarios con rol='tecnico') ──────────────────────────
function getTecnicos() {
  return db.prepare("SELECT * FROM usuarios WHERE rol = 'tecnico' ORDER BY creado_en ASC").all().map(rowToTecnico);
}

function getTecnicoById(id) {
  return rowToTecnico(db.prepare("SELECT * FROM usuarios WHERE id = ? AND rol = 'tecnico'").get(id));
}

function createTecnico(tecnico) {
  db.prepare('INSERT INTO usuarios (id, nombre, email, username, password_hash, rol, activo, creado_en) VALUES (?,?,?,?,?,?,?,?)')
    .run(tecnico.id, tecnico.nombre, tecnico.email || '', tecnico.email || '', '', 'tecnico', 1, tecnico.creadoEn || now());
  return getTecnicoById(tecnico.id);
}

function updateTecnico(id, datos) {
  const t = getTecnicoById(id);
  if (!t) return null;
  const nombre = datos.nombre ?? t.nombre;
  const email  = datos.email  ?? t.email;
  db.prepare('UPDATE usuarios SET nombre=?, email=? WHERE id=?').run(nombre, email, id);
  return getTecnicoById(id);
}

function deleteTecnico(id) {
  const info = db.prepare("DELETE FROM usuarios WHERE id = ? AND rol = 'tecnico'").run(id);
  return info.changes > 0;
}

// ─── USUARIOS ─────────────────────────────────────────────────────────────────
function hasAdmin() {
  const row = db.prepare("SELECT COUNT(*) as cnt FROM usuarios WHERE rol = 'admin' AND activo = 1").get();
  return row.cnt > 0;
}

function getUsuarios() {
  return db.prepare('SELECT * FROM usuarios ORDER BY creado_en ASC').all().map(rowToUsuario);
}

function getUsuarioById(id) {
  return rowToUsuario(db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id));
}

function getUsuarioByEmail(email) {
  return rowToUsuario(db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email));
}

function getUsuarioByUsername(username) {
  return rowToUsuario(db.prepare('SELECT * FROM usuarios WHERE username = ?').get(username));
}

function createUsuario(u) {
  db.prepare('INSERT INTO usuarios (id, nombre, email, username, password_hash, rol, activo, creado_en) VALUES (?,?,?,?,?,?,?,?)')
    .run(u.id, u.nombre, u.email || '', u.username || u.email || '', u.passwordHash, u.rol, u.activo ? 1 : 0, u.creadoEn || now());
  return getUsuarioById(u.id);
}

function updateUsuario(id, patch) {
  const u = getUsuarioById(id);
  if (!u) return null;
  const fields = [];
  const vals = [];
  if (patch.nombre !== undefined)      { fields.push('nombre=?');        vals.push(patch.nombre); }
  if (patch.email !== undefined)       { fields.push('email=?');         vals.push(patch.email); }
  if (patch.username !== undefined)    { fields.push('username=?');      vals.push(patch.username); }
  if (patch.rol !== undefined)         { fields.push('rol=?');           vals.push(patch.rol); }
  if (patch.activo !== undefined)      { fields.push('activo=?');        vals.push(patch.activo ? 1 : 0); }
  if (patch.passwordHash !== undefined){ fields.push('password_hash=?'); vals.push(patch.passwordHash); }
  if (!fields.length) return u;
  vals.push(id);
  db.prepare(`UPDATE usuarios SET ${fields.join(', ')} WHERE id=?`).run(...vals);
  return getUsuarioById(id);
}

function updateUsuarioPassword(id, passwordHash) {
  db.prepare('UPDATE usuarios SET password_hash=? WHERE id=?').run(passwordHash, id);
}

function deleteUsuario(id) {
  const info = db.prepare('DELETE FROM usuarios WHERE id = ?').run(id);
  return info.changes > 0;
}

// ─── REFRESH TOKENS ───────────────────────────────────────────────────────────
function createRefreshToken(data) {
  db.prepare('INSERT INTO refresh_tokens (id, usuario_id, token_hash, expires_at, creado_en) VALUES (?,?,?,?,?)')
    .run(data.id, data.usuarioId, data.tokenHash, data.expiresAt, now());
}

function getRefreshToken(tokenHash) {
  const r = db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?').get(tokenHash);
  if (!r) return null;
  return { id: r.id, usuarioId: r.usuario_id, tokenHash: r.token_hash, expiresAt: r.expires_at };
}

function rotateRefreshToken(oldHash, newHash, newExpires) {
  db.prepare('UPDATE refresh_tokens SET token_hash=?, expires_at=? WHERE token_hash=?').run(newHash, newExpires, oldHash);
}

function deleteRefreshToken(tokenHash) {
  db.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').run(tokenHash);
}

function deleteRefreshTokensByUsuario(usuarioId) {
  db.prepare('DELETE FROM refresh_tokens WHERE usuario_id = ?').run(usuarioId);
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
    if (t.email && !tecnicosExistentes.includes(t.email)) {
      createTecnico({ ...t, id: uuidv4(), creadoEn: now() });
      tecnicosExistentes.push(t.email);
    }
  }

  // Mapa viejo equipoId → nuevo equipoId para reasignar revisiones
  const equipoIdMap = {};
  for (const e of (equipos || [])) {
    const nuevoEquipoId = uuidv4();
    equipoIdMap[e.id] = nuevoEquipoId;
    createEquipo({ ...e, id: nuevoEquipoId, proyectoIds: [nuevoId], creadoEn: now(), actualizadoEn: now() });
  }

  // Importar revisiones reasignando al nuevo equipoId
  for (const r of (revisiones || [])) {
    const equipoIdNuevo = equipoIdMap[r.equipoId || r.equipo_id];
    if (!equipoIdNuevo) continue;
    createRevision({
      ...r,
      id: uuidv4(),
      equipoId: equipoIdNuevo,
      creadoEn: r.creadoEn || r.creado_en || now(),
      actualizadoEn: r.actualizadoEn || r.actualizado_en || now(),
    });
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
    fechaInicio: r.fecha_inicio || null,
    fechaFin: r.fecha_fin || null,
    tipo: r.tipo || 'recurrente',
    fechaEspecifica: r.fecha_especifica || null,
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

function getTareaByEquipoId(equipoId) {
  const r = db.prepare('SELECT * FROM tareas_programadas WHERE equipo_id = ? LIMIT 1').get(equipoId);
  return r ? rowToTarea(r) : null;
}

function getTareasActivas() {
  return db.prepare('SELECT * FROM tareas_programadas WHERE activa = 1').all().map(rowToTarea);
}

function createTarea(data) {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO tareas_programadas (id, equipo_id, tecnico_id, hora, dias_semana, activa, fecha_inicio, fecha_fin, tipo, fecha_especifica, creado_en)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    data.id, data.equipoId, data.tecnicoId || null,
    data.hora, J(data.diasSemana || []),
    data.activa !== false ? 1 : 0,
    data.fechaInicio || null,
    data.fechaFin || null,
    data.tipo || 'recurrente',
    data.fechaEspecifica || null,
    now
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
  if (patch.fechaInicio !== undefined) { campos.push('fecha_inicio = ?'); vals.push(patch.fechaInicio || null); }
  if (patch.fechaFin !== undefined) { campos.push('fecha_fin = ?'); vals.push(patch.fechaFin || null); }
  if (patch.tipo !== undefined) { campos.push('tipo = ?'); vals.push(patch.tipo); }
  if (patch.fechaEspecifica !== undefined) { campos.push('fecha_especifica = ?'); vals.push(patch.fechaEspecifica || null); }
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

// ── Permisos de proyecto ──────────────────────────────────────
function getPermisosProyecto(proyectoId) {
  return db.prepare('SELECT tecnico_id, nivel FROM proyecto_permisos WHERE proyecto_id = ?')
    .all(proyectoId)
    .map(r => ({ tecnicoId: r.tecnico_id, nivel: r.nivel }));
}

function setPermisosProyecto(proyectoId, restringido, permisos) {
  db.prepare('UPDATE proyectos SET restringido = ? WHERE id = ?').run(restringido ? 1 : 0, proyectoId);
  db.prepare('DELETE FROM proyecto_permisos WHERE proyecto_id = ?').run(proyectoId);
  const insert = db.prepare('INSERT INTO proyecto_permisos (proyecto_id, tecnico_id, nivel) VALUES (?,?,?)');
  for (const p of (permisos || [])) {
    insert.run(proyectoId, p.tecnicoId, p.nivel);
  }
  return { restringido, permisos };
}

// ─── TAREAS Y EQUIPOS POR TÉCNICO ────────────────────────────────────────────
function getTareasDeTecnico(tecnicoId) {
  return db.prepare('SELECT * FROM tareas_programadas WHERE tecnico_id = ? ORDER BY hora ASC')
    .all(tecnicoId).map(rowToTarea);
}

// Todas las tareas de los equipos de un proyecto
function getTareasDeProyecto(proyectoId) {
  const equipoIds = db.prepare('SELECT id FROM equipos WHERE proyecto_id = ? AND archivado = 0')
    .all(proyectoId).map(r => r.id);
  if (!equipoIds.length) return [];
  const ph = equipoIds.map(() => '?').join(',');
  return db.prepare(`SELECT * FROM tareas_programadas WHERE equipo_id IN (${ph}) ORDER BY hora ASC`)
    .all(...equipoIds).map(rowToTarea);
}

// Tareas asignadas a un técnico específicamente dentro de un proyecto
function getTareasDeTecnicoEnProyecto(tecnicoId, proyectoId) {
  const equipoIds = db.prepare('SELECT id FROM equipos WHERE proyecto_id = ? AND archivado = 0')
    .all(proyectoId).map(r => r.id);
  if (!equipoIds.length) return [];
  const ph = equipoIds.map(() => '?').join(',');
  return db.prepare(`SELECT * FROM tareas_programadas WHERE tecnico_id = ? AND equipo_id IN (${ph}) ORDER BY hora ASC`)
    .all(tecnicoId, ...equipoIds).map(rowToTarea);
}

function getEquiposDelTecnico(tecnicoId) {
  const proyectoIds = db.prepare('SELECT proyecto_id FROM proyecto_permisos WHERE tecnico_id = ?')
    .all(tecnicoId).map(r => r.proyecto_id);
  if (!proyectoIds.length) return [];
  const ph = proyectoIds.map(() => '?').join(',');
  const equipos = db.prepare(`SELECT e.*, p.nombre as proyecto_nombre FROM equipos e JOIN proyectos p ON p.id = e.proyecto_id WHERE e.proyecto_id IN (${ph}) AND e.archivado = 0 ORDER BY p.nombre, e.nombre`).all(...proyectoIds);
  return equipos.map(r => ({ ...rowToEquipo(r), proyectoNombre: r.proyecto_nombre }));
}

// ─── PERMISOS DEL TÉCNICO (desde la perspectiva del técnico) ─────────────────
function getPermisosDelTecnico(tecnicoId) {
  return db.prepare('SELECT proyecto_id, nivel FROM proyecto_permisos WHERE tecnico_id = ?')
    .all(tecnicoId)
    .map(r => ({ proyectoId: r.proyecto_id, nivel: r.nivel }));
}

// nivel: 'ver' = todas las tareas del proyecto, 'asignados' = solo las asignadas explícitamente
// proyectosScope: si se pasa, solo modifica los permisos de esos proyectos (no toca otros proyectos del técnico)
function setPermisosDelTecnico(tecnicoId, permisos, proyectosScope = null) {
  if (proyectosScope !== null) {
    if (!proyectosScope.length) return;
    const ph = proyectosScope.map(() => '?').join(',');
    db.prepare(`DELETE FROM proyecto_permisos WHERE tecnico_id = ? AND proyecto_id IN (${ph})`).run(tecnicoId, ...proyectosScope);
  } else {
    db.prepare('DELETE FROM proyecto_permisos WHERE tecnico_id = ?').run(tecnicoId);
  }
  const insert = db.prepare('INSERT INTO proyecto_permisos (proyecto_id, tecnico_id, nivel) VALUES (?,?,?)');
  for (const p of (permisos || [])) {
    insert.run(p.proyectoId, tecnicoId, p.nivel || 'asignados');
  }
}

// ─── ASIGNACIONES DE PROYECTOS (project_admin) ───────────────────────────────
function getProyectosDeUsuario(usuarioId) {
  const ids = db.prepare('SELECT proyecto_id FROM proyecto_asignaciones WHERE usuario_id = ?').all(usuarioId).map(r => r.proyecto_id);
  if (!ids.length) return [];
  const ph = ids.map(() => '?').join(',');
  return db.prepare(`SELECT * FROM proyectos WHERE id IN (${ph})`).all(...ids).map(rowToProyecto);
}

function getUsuariosDeProyecto(proyectoId) {
  return db.prepare('SELECT usuario_id FROM proyecto_asignaciones WHERE proyecto_id = ?').all(proyectoId).map(r => r.usuario_id);
}

function asignarProyecto(proyectoId, usuarioId) {
  db.prepare('INSERT OR IGNORE INTO proyecto_asignaciones (proyecto_id, usuario_id) VALUES (?,?)').run(proyectoId, usuarioId);
}

function desasignarProyecto(proyectoId, usuarioId) {
  db.prepare('DELETE FROM proyecto_asignaciones WHERE proyecto_id = ? AND usuario_id = ?').run(proyectoId, usuarioId);
}

function tieneAccesoAProyecto(usuarioId, proyectoId) {
  const r = db.prepare('SELECT 1 FROM proyecto_asignaciones WHERE proyecto_id = ? AND usuario_id = ?').get(proyectoId, usuarioId);
  return !!r;
}

// ─── Técnico con permiso elevado en proyecto (asignado por project_admin) ─────
function getPermisosElevadosTecnico(usuarioId) {
  return db.prepare("SELECT proyecto_id FROM proyecto_permisos WHERE tecnico_id = ? AND nivel = 'editar'").all(usuarioId).map(r => r.proyecto_id);
}

// ─── TECNICO ↔ SUPERVISOR (project_admin) ─────────────────────────────────────
function getSupervisoresDelTecnico(tecnicoId) {
  const rows = db.prepare(
    "SELECT u.* FROM usuarios u JOIN tecnico_supervisores ts ON ts.supervisor_id = u.id WHERE ts.tecnico_id = ?"
  ).all(tecnicoId);
  return rows.map(rowToUsuario);
}

function getTecnicosDelSupervisor(supervisorId) {
  const rows = db.prepare(
    "SELECT u.* FROM usuarios u JOIN tecnico_supervisores ts ON ts.tecnico_id = u.id WHERE ts.supervisor_id = ?"
  ).all(supervisorId);
  return rows.map(rowToUsuario);
}

function asignarTecnicoASupervisor(tecnicoId, supervisorId) {
  db.prepare('INSERT OR IGNORE INTO tecnico_supervisores (tecnico_id, supervisor_id) VALUES (?,?)').run(tecnicoId, supervisorId);
}

function desasignarTecnicoASupervisor(tecnicoId, supervisorId) {
  db.prepare('DELETE FROM tecnico_supervisores WHERE tecnico_id = ? AND supervisor_id = ?').run(tecnicoId, supervisorId);
}

// ─── PLANTILLA ↔ PROYECTOS ───────────────────────────────────────────────────
function getProyectosDePlantilla(plantillaId) {
  return db.prepare('SELECT proyecto_id FROM plantilla_proyectos WHERE plantilla_id = ?')
    .all(plantillaId).map(r => r.proyecto_id);
}

function setProyectosDePlantilla(plantillaId, proyectoIds) {
  db.prepare('DELETE FROM plantilla_proyectos WHERE plantilla_id = ?').run(plantillaId);
  const insert = db.prepare('INSERT OR IGNORE INTO plantilla_proyectos (plantilla_id, proyecto_id) VALUES (?,?)');
  for (const id of (proyectoIds || [])) {
    insert.run(plantillaId, id);
  }
}

// Plantillas asociadas a un proyecto específico
function getPlantillasDeProyecto(proyectoId) {
  const ids = db.prepare('SELECT plantilla_id FROM plantilla_proyectos WHERE proyecto_id = ?')
    .all(proyectoId).map(r => r.plantilla_id);
  if (!ids.length) return [];
  const ph = ids.map(() => '?').join(',');
  return db.prepare(`SELECT * FROM plantillas WHERE id IN (${ph}) ORDER BY nombre ASC`).all(...ids).map(rowToPlantilla);
}

// Agrega proyectoIds a cada plantilla (eficiente: una sola query extra)
function augmentarPlantillasConProyectos(plantillas) {
  if (!plantillas.length) return plantillas;
  const ids = plantillas.map(p => p.id);
  const ph = ids.map(() => '?').join(',');
  const rows = db.prepare(`SELECT plantilla_id, proyecto_id FROM plantilla_proyectos WHERE plantilla_id IN (${ph})`).all(...ids);
  const map = {};
  for (const r of rows) {
    if (!map[r.plantilla_id]) map[r.plantilla_id] = [];
    map[r.plantilla_id].push(r.proyecto_id);
  }
  return plantillas.map(p => ({ ...p, proyectoIds: map[p.id] || [] }));
}

// Plantillas visibles para un project_admin (solo las de sus proyectos)
function getPlantillasParaProyectos(proyectoIds) {
  if (!proyectoIds.length) return [];
  const ph = proyectoIds.map(() => '?').join(',');
  const ids = db.prepare(`SELECT DISTINCT plantilla_id FROM plantilla_proyectos WHERE proyecto_id IN (${ph})`)
    .all(...proyectoIds).map(r => r.plantilla_id);
  if (!ids.length) return [];
  const ph2 = ids.map(() => '?').join(',');
  return db.prepare(`SELECT * FROM plantillas WHERE id IN (${ph2}) ORDER BY nombre ASC`).all(...ids).map(rowToPlantilla);
}

// ─── Permisos especiales de técnicos ──────────────────────────────────────────
function getPermisosEspeciales(usuarioId) {
  return db.prepare('SELECT permiso FROM usuario_permisos WHERE usuario_id = ?')
    .all(usuarioId).map(r => r.permiso);
}
function setPermisosEspeciales(usuarioId, permisos) {
  db.prepare('DELETE FROM usuario_permisos WHERE usuario_id = ?').run(usuarioId);
  const insert = db.prepare('INSERT OR IGNORE INTO usuario_permisos (usuario_id, permiso) VALUES (?,?)');
  const validos = ['editar_plantillas', 'eliminar_plantillas', 'asignar_tareas'];
  for (const p of (permisos || [])) {
    if (validos.includes(p)) insert.run(usuarioId, p);
  }
}
function tienePemisoEspecial(usuarioId, permiso) {
  return !!db.prepare('SELECT 1 FROM usuario_permisos WHERE usuario_id = ? AND permiso = ?').get(usuarioId, permiso);
}

module.exports = {
  getProyectos, getProyectoById, createProyecto, updateProyecto, deleteProyecto,
  getEquipos, getEquipoById, getEquiposByProyecto, createEquipo, updateEquipo, deleteEquipo,
  getPlantillas, getPlantillaById, createPlantilla, updatePlantilla, deletePlantilla,
  getTecnicos, getTecnicoById, createTecnico, updateTecnico, deleteTecnico,
  hasAdmin,
  getUsuarios, getUsuarioById, getUsuarioByEmail, getUsuarioByUsername, createUsuario, updateUsuario, updateUsuarioPassword, deleteUsuario,
  createRefreshToken, getRefreshToken, rotateRefreshToken, deleteRefreshToken, deleteRefreshTokensByUsuario,
  getRevisiones, getRevisionesByProyecto, getRevisionById, createRevision, updateRevision, deleteRevision,
  exportarProyecto, importarProyecto, collectArchivoHashes,
  readGlobal, writeGlobal, readProyectoData, writeProyectoData,
  getTareas, getTareaById, getTareaByEquipoId, getTareasActivas, createTarea, updateTarea, deleteTarea,
  getPermisosProyecto, setPermisosProyecto,
  getProyectosDeUsuario, getUsuariosDeProyecto, asignarProyecto, desasignarProyecto, tieneAccesoAProyecto,
  getPermisosElevadosTecnico,
  getSupervisoresDelTecnico, getTecnicosDelSupervisor, asignarTecnicoASupervisor, desasignarTecnicoASupervisor,
  getPermisosDelTecnico, setPermisosDelTecnico,
  getTareasDeTecnico, getTareasDeProyecto, getTareasDeTecnicoEnProyecto, getEquiposDelTecnico,
  getProyectosDePlantilla, setProyectosDePlantilla, getPlantillasDeProyecto, getPlantillasParaProyectos,
  augmentarPlantillasConProyectos,
  getPermisosEspeciales, setPermisosEspeciales, tienePemisoEspecial,
};
