/**
 * CAPA DE ACCESO A DATOS
 * Esta capa abstrae el origen de datos.
 * Cuando se migre a base de datos, solo se modifica este archivo.
 * Las rutas y servicios NO cambian.
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/db.json');

function readDB() {
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(raw);
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// ─── EQUIPOS ────────────────────────────────────────────────
function getEquipos() {
  return readDB().equipos;
}

function getEquipoById(id) {
  return readDB().equipos.find(e => e.id === id) || null;
}

function createEquipo(equipo) {
  const db = readDB();
  db.equipos.push(equipo);
  writeDB(db);
  return equipo;
}

function updateEquipo(id, datos) {
  const db = readDB();
  const idx = db.equipos.findIndex(e => e.id === id);
  if (idx === -1) return null;
  db.equipos[idx] = { ...db.equipos[idx], ...datos, actualizadoEn: new Date().toISOString() };
  writeDB(db);
  return db.equipos[idx];
}

function deleteEquipo(id) {
  const db = readDB();
  const idx = db.equipos.findIndex(e => e.id === id);
  if (idx === -1) return false;
  db.equipos.splice(idx, 1);
  writeDB(db);
  return true;
}

// ─── PROYECTOS ─────────────────────────────────────────────
function getProyectos() {
  return readDB().proyectos;
}

function getProyectoById(id) {
  return readDB().proyectos.find(p => p.id === id) || null;
}

function createProyecto(proyecto) {
  const db = readDB();
  db.proyectos.push(proyecto);
  writeDB(db);
  return proyecto;
}

function updateProyecto(id, datos) {
  const db = readDB();
  const idx = db.proyectos.findIndex(p => p.id === id);
  if (idx === -1) return null;
  db.proyectos[idx] = { ...db.proyectos[idx], ...datos, actualizadoEn: new Date().toISOString() };
  writeDB(db);
  return db.proyectos[idx];
}

function deleteProyecto(id) {
  const db = readDB();
  const idx = db.proyectos.findIndex(p => p.id === id);
  if (idx === -1) return false;
  db.proyectos.splice(idx, 1);
  writeDB(db);
  return true;
}

// ─── PLANTILLAS ─────────────────────────────────────────────
function getPlantillas() {
  return readDB().plantillas;
}

function getPlantillaById(id) {
  return readDB().plantillas.find(p => p.id === id) || null;
}

function createPlantilla(plantilla) {
  const db = readDB();
  db.plantillas.push(plantilla);
  writeDB(db);
  return plantilla;
}

function updatePlantilla(id, datos) {
  const db = readDB();
  const idx = db.plantillas.findIndex(p => p.id === id);
  if (idx === -1) return null;
  db.plantillas[idx] = { ...db.plantillas[idx], ...datos, actualizadoEn: new Date().toISOString() };
  writeDB(db);
  return db.plantillas[idx];
}

function deletePlantilla(id) {
  const db = readDB();
  const idx = db.plantillas.findIndex(p => p.id === id);
  if (idx === -1) return false;
  db.plantillas.splice(idx, 1);
  writeDB(db);
  return true;
}

// ─── TÉCNICOS ───────────────────────────────────────────────
function getTecnicos() {
  return readDB().tecnicos;
}

function getTecnicoById(id) {
  return readDB().tecnicos.find(t => t.id === id) || null;
}

function createTecnico(tecnico) {
  const db = readDB();
  db.tecnicos.push(tecnico);
  writeDB(db);
  return tecnico;
}

function updateTecnico(id, datos) {
  const db = readDB();
  const idx = db.tecnicos.findIndex(t => t.id === id);
  if (idx === -1) return null;
  db.tecnicos[idx] = { ...db.tecnicos[idx], ...datos, actualizadoEn: new Date().toISOString() };
  writeDB(db);
  return db.tecnicos[idx];
}

function deleteTecnico(id) {
  const db = readDB();
  const idx = db.tecnicos.findIndex(t => t.id === id);
  if (idx === -1) return false;
  db.tecnicos.splice(idx, 1);
  writeDB(db);
  return true;
}

// ─── REVISIONES ─────────────────────────────────────────────
function getRevisiones(filtros = {}) {
  let revisiones = readDB().revisiones;
  if (filtros.equipoId) revisiones = revisiones.filter(r => r.equipoId === filtros.equipoId);
  if (filtros.tecnicoId) revisiones = revisiones.filter(r => r.tecnicoId === filtros.tecnicoId);
  if (filtros.estado) revisiones = revisiones.filter(r => r.estado === filtros.estado);
  return revisiones.sort((a, b) => new Date(b.creadoEn) - new Date(a.creadoEn));
}

function getRevisionById(id) {
  return readDB().revisiones.find(r => r.id === id) || null;
}

function createRevision(revision) {
  const db = readDB();
  db.revisiones.push(revision);
  writeDB(db);
  return revision;
}

function updateRevision(id, datos) {
  const db = readDB();
  const idx = db.revisiones.findIndex(r => r.id === id);
  if (idx === -1) return null;
  db.revisiones[idx] = { ...db.revisiones[idx], ...datos, actualizadoEn: new Date().toISOString() };
  writeDB(db);
  return db.revisiones[idx];
}

function deleteRevision(id) {
  const db = readDB();
  const idx = db.revisiones.findIndex(r => r.id === id);
  if (idx === -1) return false;
  db.revisiones.splice(idx, 1);
  writeDB(db);
  return true;
}

module.exports = {
  // Proyectos
  getProyectos, getProyectoById, createProyecto, updateProyecto, deleteProyecto,
  // Equipos
  getEquipos, getEquipoById, createEquipo, updateEquipo, deleteEquipo,
  // Plantillas
  getPlantillas, getPlantillaById, createPlantilla, updatePlantilla, deletePlantilla,
  // Técnicos
  getTecnicos, getTecnicoById, createTecnico, updateTecnico, deleteTecnico,
  // Revisiones
  getRevisiones, getRevisionById, createRevision, updateRevision, deleteRevision,
};
