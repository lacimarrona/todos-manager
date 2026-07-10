const { Workspace, Usuario, Proyecto, Equipo, Plantilla } = require('../../src/models');

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

module.exports = { createWorkspace, createUsuario, createProyecto, createEquipo, createPlantilla };
