const request = require('supertest');
const app = require('../../src/app');
const { resetDb } = require('../helpers/resetDb');
const { signToken } = require('../helpers/auth');
const {
  createWorkspace,
  createUsuario,
  createProyecto,
  createEquipo,
  createPlantilla,
} = require('../factories');

// Regresión de los bugs de fuga de datos entre workspaces encontrados y
// corregidos en esta sesión: endpoints que reciben un ID (tecnico_asignado_id,
// tecnico_id, plantilla_id) en el body y deben validar que ese recurso
// pertenezca al mismo workspace que el usuario autenticado.
describe('Aislamiento multi-tenant: tecnico_asignado_id / tecnico_id / plantilla_id', () => {
  let wsA, wsB, adminA, tecA, tecB, tokenA, proyA, equipoA, plantillaB;

  beforeEach(async () => {
    await resetDb();

    wsA = await createWorkspace({ nombre: 'Workspace A' });
    wsB = await createWorkspace({ nombre: 'Workspace B' });

    adminA = await createUsuario(wsA, { rol: 'admin' });
    tecA = await createUsuario(wsA, { rol: 'usuario' });
    tecB = await createUsuario(wsB, { rol: 'usuario' });

    proyA = await createProyecto(wsA);
    equipoA = await createEquipo(proyA);
    plantillaB = await createPlantilla(wsB);

    tokenA = signToken(adminA);
  });

  it('POST /api/equipos rechaza tecnico_asignado_id de otro workspace (404)', async () => {
    const res = await request(app)
      .post('/api/equipos')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ proyecto_id: proyA.id, nombre: 'Equipo ataque', tecnico_asignado_id: tecB.id });

    expect(res.status).toBe(404);
  });

  it('POST /api/equipos acepta tecnico_asignado_id del propio workspace (201)', async () => {
    const res = await request(app)
      .post('/api/equipos')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ proyecto_id: proyA.id, nombre: 'Equipo legitimo', tecnico_asignado_id: tecA.id });

    expect(res.status).toBe(201);
    expect(res.body.tecnico_asignado_id).toBe(tecA.id);
  });

  it('PUT /api/equipos/:id rechaza tecnico_asignado_id de otro workspace (404)', async () => {
    const res = await request(app)
      .put(`/api/equipos/${equipoA.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ tecnico_asignado_id: tecB.id });

    expect(res.status).toBe(404);
  });

  it('PUT /api/equipos/:id acepta tecnico_asignado_id del propio workspace (200)', async () => {
    const res = await request(app)
      .put(`/api/equipos/${equipoA.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ tecnico_asignado_id: tecA.id });

    expect(res.status).toBe(200);
    expect(res.body.tecnico_asignado_id).toBe(tecA.id);
  });

  it('POST /api/equipos/importar-masivo rechaza tecnico_asignado_id de otro workspace (404)', async () => {
    const res = await request(app)
      .post('/api/equipos/importar-masivo')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        proyecto_id: proyA.id,
        equipos: [{ nombre: 'Masivo 1' }],
        tecnico_asignado_id: tecB.id,
      });

    expect(res.status).toBe(404);
  });

  it('POST /api/equipos/importar-masivo rechaza plantilla_id de otro workspace (404)', async () => {
    const res = await request(app)
      .post('/api/equipos/importar-masivo')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        proyecto_id: proyA.id,
        equipos: [{ nombre: 'Masivo 1' }],
        plantilla_id: plantillaB.id,
      });

    expect(res.status).toBe(404);
  });

  it('POST /api/revisiones rechaza tecnico_id de otro workspace (404)', async () => {
    const res = await request(app)
      .post('/api/revisiones')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ equipo_id: equipoA.id, tecnico_id: tecB.id });

    expect(res.status).toBe(404);
  });

  it('POST /api/revisiones acepta tecnico_id del propio workspace (201)', async () => {
    const res = await request(app)
      .post('/api/revisiones')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ equipo_id: equipoA.id, tecnico_id: tecA.id });

    expect(res.status).toBe(201);
    expect(res.body.tecnico_id).toBe(tecA.id);
  });

  it('PUT /api/revisiones/:id rechaza tecnico_id de otro workspace (404)', async () => {
    const created = await request(app)
      .post('/api/revisiones')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ equipo_id: equipoA.id, tecnico_id: tecA.id });

    const res = await request(app)
      .put(`/api/revisiones/${created.body.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ tecnico_id: tecB.id });

    expect(res.status).toBe(404);
  });
});
