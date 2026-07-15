const {
  Workspace, Usuario, Proyecto, Equipo, Plantilla, ItemPlantilla,
  ProyectoPermiso, TareaProgramada,
} = require('../../src/models');

let counter = 0;
function uniq(prefix) {
  counter += 1;
  return `${prefix}${counter}`;
}

async function createWorkspace(overrides = {}) {
  return Workspace.create({ nombre: uniq('Workspace '), ...overrides });
}

async function createUsuario(workspace, overrides = {}) {
  return Usuario.create({
    workspace_id: workspace ? workspace.id : null,
    nombre: uniq('Usuario '),
    email: `${uniq('user')}@test.com`,
    password_hash: 'no-usado-en-estos-tests',
    rol: 'usuario',
    ...overrides,
  });
}

async function createProyecto(workspace, overrides = {}) {
  return Proyecto.create({
    workspace_id: workspace.id,
    nombre: uniq('Proyecto '),
    ...overrides,
  });
}

async function createEquipo(proyecto, overrides = {}) {
  return Equipo.create({
    proyecto_id: proyecto.id,
    nombre: uniq('Equipo '),
    ...overrides,
  });
}

async function createPlantilla(workspace, overrides = {}) {
  return Plantilla.create({
    workspace_id: workspace.id,
    nombre: uniq('Plantilla '),
    ...overrides,
  });
}

async function createItemPlantilla(plantilla, overrides = {}) {
  return ItemPlantilla.create({
    plantilla_id: plantilla.id,
    label: uniq('Item '),
    orden: 0,
    ...overrides,
  });
}

async function createProyectoPermiso(proyecto, usuario, nivel = 'ver') {
  return ProyectoPermiso.create({
    proyecto_id: proyecto.id,
    usuario_id:  usuario.id,
    nivel,
  });
}

async function createTareaProgramada(equipo, overrides = {}) {
  return TareaProgramada.create({
    equipo_id:   equipo.id,
    hora:        '09:00:00',
    dias_semana: [1, 2, 3, 4, 5], // lun-vie
    activa:      true,
    ...overrides,
  });
}

module.exports = {
  createWorkspace,
  createUsuario,
  createProyecto,
  createEquipo,
  createPlantilla,
  createItemPlantilla,
  createProyectoPermiso,
  createTareaProgramada,
};
