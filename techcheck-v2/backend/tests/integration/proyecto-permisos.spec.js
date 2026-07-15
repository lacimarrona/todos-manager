'use strict';

/**
 * Tests de integración para las funcionalidades nuevas:
 *  - Control de acceso por proyecto (restringido + proyecto_permisos)
 *  - Endpoint GET /api/proyectos/:id/tareas-vencidas
 *  - Endpoints GET/PUT /api/proyectos/:id/permisos (solo admin/superadmin)
 *  - Aislamiento multi-tenant en listado de proyectos
 */

const request = require('supertest');
const app = require('../../src/app');
const { resetDb } = require('../helpers/resetDb');
const { signToken } = require('../helpers/auth');
const {
  createWorkspace,
  createUsuario,
  createProyecto,
  createEquipo,
  createProyectoPermiso,
  createTareaProgramada,
} = require('../factories');

// ─────────────────────────────────────────────────────────────────────────────
// Bloque 1: Aislamiento multi-tenant + proyectos restringidos
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/proyectos — aislamiento multi-tenant y acceso restringido', () => {
  let wsA, wsB, adminA, usuarioA, proyAbierto, proyRestringido, proyB, tokenAdmin, tokenUsuario;

  beforeEach(async () => {
    await resetDb();

    wsA = await createWorkspace({ nombre: 'Workspace A' });
    wsB = await createWorkspace({ nombre: 'Workspace B' });

    adminA    = await createUsuario(wsA, { rol: 'admin' });
    usuarioA  = await createUsuario(wsA, { rol: 'usuario' });

    proyAbierto     = await createProyecto(wsA, { restringido: false });
    proyRestringido = await createProyecto(wsA, { restringido: true });
    proyB           = await createProyecto(wsB);

    tokenAdmin   = signToken(adminA);
    tokenUsuario = signToken(usuarioA);
  });

  it('admin ve todos los proyectos de su workspace (incluso restringidos)', async () => {
    const res = await request(app)
      .get('/api/proyectos')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(200);
    const ids = res.body.map(p => p.id);
    expect(ids).toContain(proyAbierto.id);
    expect(ids).toContain(proyRestringido.id);
    expect(ids).not.toContain(proyB.id);
  });

  it('usuario regular ve proyectos no restringidos de su workspace', async () => {
    const res = await request(app)
      .get('/api/proyectos')
      .set('Authorization', `Bearer ${tokenUsuario}`);

    expect(res.status).toBe(200);
    const ids = res.body.map(p => p.id);
    expect(ids).toContain(proyAbierto.id);
    expect(ids).not.toContain(proyB.id);
  });

  it('usuario regular NO ve proyecto restringido sin permiso explícito', async () => {
    const res = await request(app)
      .get('/api/proyectos')
      .set('Authorization', `Bearer ${tokenUsuario}`);

    expect(res.status).toBe(200);
    const ids = res.body.map(p => p.id);
    expect(ids).not.toContain(proyRestringido.id);
  });

  it('usuario regular SÍ ve proyecto restringido cuando tiene permiso explícito', async () => {
    await createProyectoPermiso(proyRestringido, usuarioA, 'ver');

    const res = await request(app)
      .get('/api/proyectos')
      .set('Authorization', `Bearer ${tokenUsuario}`);

    expect(res.status).toBe(200);
    const ids = res.body.map(p => p.id);
    expect(ids).toContain(proyRestringido.id);
  });

  it('usuario NO ve proyectos de otro workspace aunque no estén restringidos', async () => {
    const res = await request(app)
      .get('/api/proyectos')
      .set('Authorization', `Bearer ${tokenUsuario}`);

    expect(res.status).toBe(200);
    const ids = res.body.map(p => p.id);
    expect(ids).not.toContain(proyB.id);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bloque 2: GET /api/proyectos/:id — acceso individual a proyecto restringido
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/proyectos/:id — acceso a proyecto restringido por id', () => {
  let wsA, adminA, usuarioA, proyRestringido, tokenAdmin, tokenUsuario;

  beforeEach(async () => {
    await resetDb();

    wsA = await createWorkspace({ nombre: 'WS A' });
    adminA   = await createUsuario(wsA, { rol: 'admin' });
    usuarioA = await createUsuario(wsA, { rol: 'usuario' });
    proyRestringido = await createProyecto(wsA, { restringido: true });
    tokenAdmin   = signToken(adminA);
    tokenUsuario = signToken(usuarioA);
  });

  it('admin puede ver proyecto restringido sin permiso explícito (200)', async () => {
    const res = await request(app)
      .get(`/api/proyectos/${proyRestringido.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(proyRestringido.id);
  });

  it('usuario sin permiso no puede ver proyecto restringido (404)', async () => {
    const res = await request(app)
      .get(`/api/proyectos/${proyRestringido.id}`)
      .set('Authorization', `Bearer ${tokenUsuario}`);

    expect(res.status).toBe(404);
  });

  it('usuario con permiso puede ver proyecto restringido (200)', async () => {
    await createProyectoPermiso(proyRestringido, usuarioA, 'ver');

    const res = await request(app)
      .get(`/api/proyectos/${proyRestringido.id}`)
      .set('Authorization', `Bearer ${tokenUsuario}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(proyRestringido.id);
  });

  it('acceso a proyecto de otro workspace devuelve 404', async () => {
    const wsB = await createWorkspace({ nombre: 'WS B' });
    const proyB = await createProyecto(wsB, { restringido: false });

    const res = await request(app)
      .get(`/api/proyectos/${proyB.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bloque 3: GET/PUT /api/proyectos/:id/permisos — solo admin/superadmin
// ─────────────────────────────────────────────────────────────────────────────
describe('GET/PUT /api/proyectos/:id/permisos — control de roles', () => {
  let wsA, adminA, usuarioA, usuarioB, proyecto, tokenAdmin, tokenUsuario;

  beforeEach(async () => {
    await resetDb();

    wsA = await createWorkspace({ nombre: 'WS A' });
    adminA   = await createUsuario(wsA, { rol: 'admin' });
    usuarioA = await createUsuario(wsA, { rol: 'usuario' });
    usuarioB = await createUsuario(wsA, { rol: 'usuario' });
    proyecto = await createProyecto(wsA);
    tokenAdmin   = signToken(adminA);
    tokenUsuario = signToken(usuarioA);
  });

  it('GET permisos — usuario regular recibe 403', async () => {
    const res = await request(app)
      .get(`/api/proyectos/${proyecto.id}/permisos`)
      .set('Authorization', `Bearer ${tokenUsuario}`);

    expect(res.status).toBe(403);
  });

  it('GET permisos — admin recibe 200 con estructura correcta', async () => {
    const res = await request(app)
      .get(`/api/proyectos/${proyecto.id}/permisos`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('proyecto_id', proyecto.id);
    expect(res.body).toHaveProperty('restringido');
    expect(Array.isArray(res.body.permisos)).toBe(true);
  });

  it('PUT permisos — usuario regular recibe 403', async () => {
    const res = await request(app)
      .put(`/api/proyectos/${proyecto.id}/permisos`)
      .set('Authorization', `Bearer ${tokenUsuario}`)
      .send({ restringido: true, permisos: [] });

    expect(res.status).toBe(403);
  });

  it('PUT permisos — admin puede marcar proyecto como restringido y asignar permisos', async () => {
    const res = await request(app)
      .put(`/api/proyectos/${proyecto.id}/permisos`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        restringido: true,
        permisos: [{ usuario_id: usuarioA.id, nivel: 'ver' }],
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('proyecto_id', proyecto.id);
  });

  it('PUT permisos — admin puede hacer bulk-replace de permisos', async () => {
    // Primero agregar permiso a usuarioA
    await request(app)
      .put(`/api/proyectos/${proyecto.id}/permisos`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ permisos: [{ usuario_id: usuarioA.id, nivel: 'ver' }] });

    // Luego reemplazar con usuarioB
    await request(app)
      .put(`/api/proyectos/${proyecto.id}/permisos`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ permisos: [{ usuario_id: usuarioB.id, nivel: 'editar' }] });

    // Verificar con GET
    const getRes = await request(app)
      .get(`/api/proyectos/${proyecto.id}/permisos`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(getRes.status).toBe(200);
    const permisos = getRes.body.permisos;
    const ids = permisos.map(p => p.usuario_id);
    expect(ids).not.toContain(usuarioA.id);  // reemplazado
    expect(ids).toContain(usuarioB.id);       // nuevo
    const permB = permisos.find(p => p.usuario_id === usuarioB.id);
    expect(permB.nivel).toBe('editar');
  });

  it('PUT permisos — pasar permisos:[] vacía elimina todos los permisos', async () => {
    // Agregar un permiso primero
    await createProyectoPermiso(proyecto, usuarioA, 'ver');

    await request(app)
      .put(`/api/proyectos/${proyecto.id}/permisos`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ permisos: [] });

    const getRes = await request(app)
      .get(`/api/proyectos/${proyecto.id}/permisos`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(getRes.body.permisos).toHaveLength(0);
  });

  it('usuario con permiso "ver" aparece en GET permisos', async () => {
    await createProyectoPermiso(proyecto, usuarioA, 'editar');

    const res = await request(app)
      .get(`/api/proyectos/${proyecto.id}/permisos`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(200);
    const perm = res.body.permisos.find(p => p.usuario_id === usuarioA.id);
    expect(perm).toBeDefined();
    expect(perm.nivel).toBe('editar');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bloque 4: GET /api/proyectos/:id/tareas-vencidas
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/proyectos/:id/tareas-vencidas', () => {
  let wsA, wsB, adminA, adminB, proyecto, proyectoB, equipo, tokenAdminA, tokenAdminB;

  beforeEach(async () => {
    await resetDb();

    wsA = await createWorkspace({ nombre: 'WS A' });
    wsB = await createWorkspace({ nombre: 'WS B' });
    adminA = await createUsuario(wsA, { rol: 'admin' });
    adminB = await createUsuario(wsB, { rol: 'admin' });
    proyecto   = await createProyecto(wsA);
    proyectoB  = await createProyecto(wsB);
    equipo     = await createEquipo(proyecto);
    tokenAdminA = signToken(adminA);
    tokenAdminB = signToken(adminB);
  });

  it('devuelve array vacío si no hay tareas programadas activas', async () => {
    const res = await request(app)
      .get(`/api/proyectos/${proyecto.id}/tareas-vencidas`)
      .set('Authorization', `Bearer ${tokenAdminA}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('devuelve 404 para proyecto de otro workspace', async () => {
    const res = await request(app)
      .get(`/api/proyectos/${proyectoB.id}/tareas-vencidas`)
      .set('Authorization', `Bearer ${tokenAdminA}`);

    expect(res.status).toBe(404);
  });

  it('usuario sin auth recibe 401', async () => {
    const res = await request(app)
      .get(`/api/proyectos/${proyecto.id}/tareas-vencidas`);

    expect(res.status).toBe(401);
  });

  it('devuelve tareas vencidas cuando existen tareas programadas sin revisión', async () => {
    // Crear tarea que ocurre TODOS los días de la semana
    await createTareaProgramada(equipo, { dias_semana: [0, 1, 2, 3, 4, 5, 6] });

    const res = await request(app)
      .get(`/api/proyectos/${proyecto.id}/tareas-vencidas`)
      .set('Authorization', `Bearer ${tokenAdminA}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Con días_semana=[0..6] y 30 días atrás, debe haber varias ocurrencias
    expect(res.body.length).toBeGreaterThan(0);

    const primera = res.body[0];
    expect(primera).toHaveProperty('tarea_id');
    expect(primera).toHaveProperty('equipo_id', equipo.id);
    expect(primera).toHaveProperty('equipo_nombre');
    expect(primera).toHaveProperty('fecha_programada');
    expect(primera).toHaveProperty('hora');
    expect(primera).toHaveProperty('dias_semana');
  });

  it('no devuelve ocurrencias de tareas inactivas', async () => {
    await createTareaProgramada(equipo, {
      dias_semana: [0, 1, 2, 3, 4, 5, 6],
      activa: false,
    });

    const res = await request(app)
      .get(`/api/proyectos/${proyecto.id}/tareas-vencidas`)
      .set('Authorization', `Bearer ${tokenAdminA}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('no devuelve datos de otro workspace', async () => {
    const equipoB = await createEquipo(proyectoB);
    await createTareaProgramada(equipoB, { dias_semana: [0, 1, 2, 3, 4, 5, 6] });

    // AdminA no puede ver el proyecto de WS B
    const res = await request(app)
      .get(`/api/proyectos/${proyectoB.id}/tareas-vencidas`)
      .set('Authorization', `Bearer ${tokenAdminA}`);

    expect(res.status).toBe(404);
  });

  it('usuario regular puede acceder (no restringido por rol)', async () => {
    const usuarioA = await createUsuario(wsA, { rol: 'usuario' });
    const tokenUsuario = signToken(usuarioA);

    const res = await request(app)
      .get(`/api/proyectos/${proyecto.id}/tareas-vencidas`)
      .set('Authorization', `Bearer ${tokenUsuario}`);

    // El endpoint está bajo auth (cualquier usuario autenticado), no bajo roles
    expect(res.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bloque 5: PUT /api/proyectos/:id — campo restringido
// ─────────────────────────────────────────────────────────────────────────────
describe('PUT /api/proyectos/:id — campo restringido', () => {
  let wsA, adminA, proyecto, tokenAdmin;

  beforeEach(async () => {
    await resetDb();
    wsA = await createWorkspace({ nombre: 'WS A' });
    adminA  = await createUsuario(wsA, { rol: 'admin' });
    proyecto = await createProyecto(wsA, { restringido: false });
    tokenAdmin = signToken(adminA);
  });

  it('admin puede activar campo restringido (true)', async () => {
    const res = await request(app)
      .put(`/api/proyectos/${proyecto.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ restringido: true });

    expect(res.status).toBe(200);
    expect(res.body.restringido).toBe(true);
  });

  it('admin puede desactivar campo restringido (false)', async () => {
    // Primero activar
    await request(app)
      .put(`/api/proyectos/${proyecto.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ restringido: true });

    // Luego desactivar
    const res = await request(app)
      .put(`/api/proyectos/${proyecto.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ restringido: false });

    expect(res.status).toBe(200);
    expect(res.body.restringido).toBe(false);
  });
});
