const fs = require('fs');
const path = require('path');

const GLOBAL_PATH = path.join(__dirname, '../data/global.json');
const PROYECTOS_DIR = path.join(__dirname, '../data/proyectos');

// Crear directorio si no existe
if (!fs.existsSync(PROYECTOS_DIR)) fs.mkdirSync(PROYECTOS_DIR, { recursive: true });

// ─── GLOBAL (proyectos, tecnicos, plantillas) ────────────────
function readGlobal() {
  if (!fs.existsSync(GLOBAL_PATH)) {
    const empty = { proyectos: [], tecnicos: [], plantillas: [] };
    fs.writeFileSync(GLOBAL_PATH, JSON.stringify(empty, null, 2));
    return empty;
  }
  return JSON.parse(fs.readFileSync(GLOBAL_PATH, 'utf-8'));
}

function writeGlobal(data) {
  fs.writeFileSync(GLOBAL_PATH, JSON.stringify(data, null, 2));
}

// ─── PROYECTO DATA (equipos + revisiones por proyecto) ───────
function getProyectoPath(proyectoId) {
  return path.join(PROYECTOS_DIR, `${proyectoId}.json`);
}

function readProyectoData(proyectoId) {
  const p = getProyectoPath(proyectoId);
  if (!fs.existsSync(p)) return { equipos: [], revisiones: [] };
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function writeProyectoData(proyectoId, data) {
  fs.writeFileSync(getProyectoPath(proyectoId), JSON.stringify(data, null, 2));
}

// ─── PROYECTOS ───────────────────────────────────────────────
function getProyectos() { return readGlobal().proyectos; }

function getProyectoById(id) {
  return readGlobal().proyectos.find(p => p.id === id) || null;
}

function createProyecto(proyecto) {
  const g = readGlobal();
  g.proyectos.push(proyecto);
  writeGlobal(g);
  writeProyectoData(proyecto.id, { equipos: [], revisiones: [] });
  return proyecto;
}

function updateProyecto(id, datos) {
  const g = readGlobal();
  const idx = g.proyectos.findIndex(p => p.id === id);
  if (idx === -1) return null;
  g.proyectos[idx] = { ...g.proyectos[idx], ...datos, actualizadoEn: new Date().toISOString() };
  writeGlobal(g);
  return g.proyectos[idx];
}

function deleteProyecto(id) {
  const g = readGlobal();
  const idx = g.proyectos.findIndex(p => p.id === id);
  if (idx === -1) return false;
  g.proyectos.splice(idx, 1);
  writeGlobal(g);
  const p = getProyectoPath(id);
  if (fs.existsSync(p)) fs.unlinkSync(p);
  return true;
}

// ─── EQUIPOS ────────────────────────────────────────────────
function getEquipos() {
  const proyectos = getProyectos();
  let todos = [];
  proyectos.forEach(p => {
    const data = readProyectoData(p.id);
    todos = todos.concat(data.equipos);
  });
  return todos;
}

function getEquipoById(id) {
  const proyectos = getProyectos();
  for (const p of proyectos) {
    const data = readProyectoData(p.id);
    const equipo = data.equipos.find(e => e.id === id);
    if (equipo) return equipo;
  }
  return null;
}

function getEquiposByProyecto(proyectoId) {
  return readProyectoData(proyectoId).equipos;
}

function createEquipo(equipo) {
  const proyectoId = equipo.proyectoIds && equipo.proyectoIds[0];
  if (!proyectoId) return equipo;
  const data = readProyectoData(proyectoId);
  data.equipos.push(equipo);
  writeProyectoData(proyectoId, data);
  return equipo;
}

function updateEquipo(id, datos) {
  const proyectos = getProyectos();
  for (const p of proyectos) {
    const data = readProyectoData(p.id);
    const idx = data.equipos.findIndex(e => e.id === id);
    if (idx !== -1) {
      data.equipos[idx] = { ...data.equipos[idx], ...datos, actualizadoEn: new Date().toISOString() };
      writeProyectoData(p.id, data);
      return data.equipos[idx];
    }
  }
  return null;
}

function deleteEquipo(id) {
  const proyectos = getProyectos();
  for (const p of proyectos) {
    const data = readProyectoData(p.id);
    const idx = data.equipos.findIndex(e => e.id === id);
    if (idx !== -1) {
      data.equipos.splice(idx, 1);
      writeProyectoData(p.id, data);
      return true;
    }
  }
  return false;
}

// ─── REVISIONES ─────────────────────────────────────────────
function getRevisiones(filtros = {}) {
  const proyectos = getProyectos();
  let todas = [];
  proyectos.forEach(p => {
    const data = readProyectoData(p.id);
    todas = todas.concat(data.revisiones);
  });
  if (filtros.equipoId) todas = todas.filter(r => r.equipoId === filtros.equipoId);
  if (filtros.tecnicoId) todas = todas.filter(r => r.tecnicoId === filtros.tecnicoId);
  if (filtros.estado) todas = todas.filter(r => r.estado === filtros.estado);
  return todas.sort((a, b) => new Date(b.creadoEn) - new Date(a.creadoEn));
}

function getRevisionesByProyecto(proyectoId) {
  return readProyectoData(proyectoId).revisiones;
}

function getRevisionById(id) {
  const proyectos = getProyectos();
  for (const p of proyectos) {
    const data = readProyectoData(p.id);
    const revision = data.revisiones.find(r => r.id === id);
    if (revision) return revision;
  }
  return null;
}

function createRevision(revision) {
  // Encontrar el proyecto del equipo
  const proyectos = getProyectos();
  for (const p of proyectos) {
    const data = readProyectoData(p.id);
    const equipo = data.equipos.find(e => e.id === revision.equipoId);
    if (equipo) {
      data.revisiones.push(revision);
      writeProyectoData(p.id, data);
      return revision;
    }
  }
  return revision;
}

function updateRevision(id, datos) {
  const proyectos = getProyectos();
  for (const p of proyectos) {
    const data = readProyectoData(p.id);
    const idx = data.revisiones.findIndex(r => r.id === id);
    if (idx !== -1) {
      data.revisiones[idx] = { ...data.revisiones[idx], ...datos, actualizadoEn: new Date().toISOString() };
      writeProyectoData(p.id, data);
      return data.revisiones[idx];
    }
  }
  return null;
}

function deleteRevision(id) {
  const proyectos = getProyectos();
  for (const p of proyectos) {
    const data = readProyectoData(p.id);
    const idx = data.revisiones.findIndex(r => r.id === id);
    if (idx !== -1) {
      data.revisiones.splice(idx, 1);
      writeProyectoData(p.id, data);
      return true;
    }
  }
  return false;
}

// ─── PLANTILLAS ─────────────────────────────────────────────
function getPlantillas() { return readGlobal().plantillas; }

function getPlantillaById(id) {
  return readGlobal().plantillas.find(p => p.id === id) || null;
}

function createPlantilla(plantilla) {
  const g = readGlobal();
  g.plantillas.push(plantilla);
  writeGlobal(g);
  return plantilla;
}

function updatePlantilla(id, datos) {
  const g = readGlobal();
  const idx = g.plantillas.findIndex(p => p.id === id);
  if (idx === -1) return null;
  g.plantillas[idx] = { ...g.plantillas[idx], ...datos, actualizadoEn: new Date().toISOString() };
  writeGlobal(g);
  return g.plantillas[idx];
}

function deletePlantilla(id) {
  const g = readGlobal();
  const idx = g.plantillas.findIndex(p => p.id === id);
  if (idx === -1) return false;
  g.plantillas.splice(idx, 1);
  writeGlobal(g);
  return true;
}

// ─── TECNICOS ───────────────────────────────────────────────
function getTecnicos() { return readGlobal().tecnicos; }

function getTecnicoById(id) {
  return readGlobal().tecnicos.find(t => t.id === id) || null;
}

function createTecnico(tecnico) {
  const g = readGlobal();
  g.tecnicos.push(tecnico);
  writeGlobal(g);
  return tecnico;
}

function updateTecnico(id, datos) {
  const g = readGlobal();
  const idx = g.tecnicos.findIndex(t => t.id === id);
  if (idx === -1) return null;
  g.tecnicos[idx] = { ...g.tecnicos[idx], ...datos, actualizadoEn: new Date().toISOString() };
  writeGlobal(g);
  return g.tecnicos[idx];
}

function deleteTecnico(id) {
  const g = readGlobal();
  const idx = g.tecnicos.findIndex(t => t.id === id);
  if (idx === -1) return false;
  g.tecnicos.splice(idx, 1);
  writeGlobal(g);
  return true;
}

// ─── EXPORTAR / IMPORTAR PROYECTO ───────────────────────────
function exportarProyecto(proyectoId) {
  const proyecto = getProyectoById(proyectoId);
  if (!proyecto) return null;
  const data = readProyectoData(proyectoId);
  const tecnicos = getTecnicos();
  return { proyecto, equipos: data.equipos, revisiones: data.revisiones, tecnicos };
}

function importarProyecto(datos) {
  const { v4: uuidv4 } = require('uuid');
  const { proyecto, equipos, revisiones, tecnicos } = datos;

  // Crear proyecto con nuevo ID
  const nuevoProyectoId = uuidv4();
  const nuevoProyecto = {
    ...proyecto,
    id: nuevoProyectoId,
    creadoEn: new Date().toISOString(),
    actualizadoEn: new Date().toISOString()
  };
  const g = readGlobal();
  g.proyectos.push(nuevoProyecto);

  // Importar tecnicos que no existan
  const tecnicosExistentes = g.tecnicos.map(t => t.email);
  (tecnicos || []).forEach(t => {
    if (!tecnicosExistentes.includes(t.email)) {
      g.tecnicos.push({ ...t, id: uuidv4(), creadoEn: new Date().toISOString() });
    }
  });
  writeGlobal(g);

  // Crear archivo del proyecto con equipos y revisiones
  writeProyectoData(nuevoProyectoId, {
    equipos: (equipos || []).map(e => ({ ...e, proyectoIds: [nuevoProyectoId] })),
    revisiones: revisiones || []
  });

  return nuevoProyecto;
}

module.exports = {
  getProyectos, getProyectoById, createProyecto, updateProyecto, deleteProyecto,
  getEquipos, getEquipoById, getEquiposByProyecto, createEquipo, updateEquipo, deleteEquipo,
  getPlantillas, getPlantillaById, createPlantilla, updatePlantilla, deletePlantilla,
  getTecnicos, getTecnicoById, createTecnico, updateTecnico, deleteTecnico,
  getRevisiones, getRevisionesByProyecto, getRevisionById, createRevision, updateRevision, deleteRevision,
  exportarProyecto, importarProyecto,
  readProyectoData, writeProyectoData,
};