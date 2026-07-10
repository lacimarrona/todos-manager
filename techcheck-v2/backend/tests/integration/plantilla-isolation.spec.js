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
  createItemPlantilla,
} = require('../factories');

// Confirma que plantilla.controller.js aisla correctamente por workspace (sin
// bugs encontrados aqui, a diferencia de equipo/revision) y lo deja como
// regresion permanente.
describe('Aislamiento multi-tenant: plantilla.controller.js', () => {
  let wsA, adminA, tokenA, plantillaA, plantillaB, equipoA, equipoB;

  beforeEach(async () => {
    await resetDb();

    wsA = await createWorkspace({ nombre: 'Workspace A' });
    const wsB = await createWorkspace({ nombre: 'Workspace B' });

    adminA = await createUsuario(wsA, { rol: 'admin' });
    tokenA = signToken(adminA);

    const proyA = await createProyecto(wsA);
    equipoA = await createEquipo(proyA);

    const proyB = await createProyecto(wsB);
    equipoB = await createEquipo(proyB);

    plantillaA = await createPlantilla(wsA);
    await createItemPlantilla(plantillaA);

    plantillaB = await createPlantilla(wsB);
    await createItemPlantilla(plantillaB);
  });

  it('GET /api/plantillas/:id de otro workspace devuelve 404', async () => {
    const res = await request(app)
      .get(`/api/plantillas/${plantillaB.id}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
  });

  it('GET /api/plantillas/:id del propio workspace devuelve 200', async () => {
    const res = await request(app)
      .get(`/api/plantillas/${plantillaA.id}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
  });

  it('PUT /api/plantillas/:id de otro workspace devuelve 404', async () => {
    const res = await request(app)
      .put(`/api/plantillas/${plantillaB.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nombre: 'Hackeada' });

    expect(res.status).toBe(404);
  });

  it('DELETE /api/plantillas/:id de otro workspace devuelve 404', async () => {
    const res = await request(app)
      .delete(`/api/plantillas/${plantillaB.id}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
  });

  it('POST /api/plantillas/:id/aplicar rechaza equipo_id de otro workspace (404)', async () => {
    const res = await request(app)
      .post(`/api/plantillas/${plantillaA.id}/aplicar`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ equipo_id: equipoB.id });

    expect(res.status).toBe(404);
  });

  it('POST /api/plantillas/:id/aplicar funciona con plantilla y equipo del propio workspace', async () => {
    const res = await request(app)
      .post(`/api/plantillas/${plantillaA.id}/aplicar`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ equipo_id: equipoA.id });

    expect(res.status).toBe(200);
  });
});
