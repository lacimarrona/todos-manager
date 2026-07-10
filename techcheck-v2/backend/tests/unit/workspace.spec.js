const { wsId, wsIdFiltrable } = require('../../src/utils/workspace');

describe('wsId', () => {
  it('devuelve null para superadmin, sin importar su workspace_id', () => {
    expect(wsId({ user: { rol: 'superadmin', workspace_id: null } })).toBeNull();
    expect(wsId({ user: { rol: 'superadmin', workspace_id: 5 } })).toBeNull();
  });

  it('devuelve el workspace_id del usuario para admin', () => {
    expect(wsId({ user: { rol: 'admin', workspace_id: 3 } })).toBe(3);
  });

  it('devuelve el workspace_id del usuario para usuario', () => {
    expect(wsId({ user: { rol: 'usuario', workspace_id: 7 } })).toBe(7);
  });
});

describe('wsIdFiltrable', () => {
  it('superadmin sin ?workspace_id en query devuelve null (sin filtro)', () => {
    expect(wsIdFiltrable({ user: { rol: 'superadmin' }, query: {} })).toBeNull();
  });

  it('superadmin con ?workspace_id en query devuelve ese id parseado a número', () => {
    expect(wsIdFiltrable({ user: { rol: 'superadmin' }, query: { workspace_id: '9' } })).toBe(9);
  });

  it('admin ignora el query.workspace_id y usa siempre el propio', () => {
    expect(
      wsIdFiltrable({ user: { rol: 'admin', workspace_id: 3 }, query: { workspace_id: '999' } })
    ).toBe(3);
  });

  it('usuario ignora el query.workspace_id y usa siempre el propio', () => {
    expect(
      wsIdFiltrable({ user: { rol: 'usuario', workspace_id: 4 }, query: { workspace_id: '999' } })
    ).toBe(4);
  });
});
