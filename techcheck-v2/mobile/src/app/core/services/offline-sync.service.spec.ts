import { TestBed } from '@angular/core/testing';
import { throwError } from 'rxjs';
import { OfflineSyncService, PendingOp } from './offline-sync.service';
import { ApiService } from './api.service';

// @capacitor/preferences y @capacitor/network se importan de forma estática en
// offline-sync.service.ts (no vía inyección de dependencias), así que hay que
// mockear el módulo completo en vez de reemplazar un provider de TestBed.
vi.mock('@capacitor/preferences', () => ({
  Preferences: { get: vi.fn(), set: vi.fn() },
}));
vi.mock('@capacitor/network', () => ({
  Network: { getStatus: vi.fn(), addListener: vi.fn() },
}));

import { Preferences } from '@capacitor/preferences';

const QUEUE_KEY = 'tc_queue';
const REV_KEY = (eid: number) => `tc_rev_${eid}`;

function mockQueue(ops: PendingOp[]) {
  (Preferences.get as ReturnType<typeof vi.fn>).mockImplementation(({ key }: { key: string }) => {
    if (key === QUEUE_KEY) return Promise.resolve({ value: JSON.stringify(ops) });
    return Promise.resolve({ value: null });
  });
}

function baseOp(overrides: Partial<PendingOp> = {}): PendingOp {
  return {
    id: 'op1',
    tipo: 'update_item',
    equipoId: 5,
    payload: { itemEquipoId: 1, checked: true },
    timestamp: Date.now(),
    intentos: 0,
    ...overrides,
  };
}

describe('OfflineSyncService.sync()', () => {
  let api: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn> };
  let service: OfflineSyncService;

  beforeEach(() => {
    vi.clearAllMocks();
    api = { get: vi.fn(), post: vi.fn(), put: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: api }],
    });
    service = TestBed.inject(OfflineSyncService);
  });

  it('con la cola vacía, no llama a ApiService', async () => {
    mockQueue([]);

    await service.sync();

    expect(api.get).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
    expect(api.put).not.toHaveBeenCalled();
  });

  it('update_item sin revisión resuelta (ni en revMap ni en cache) queda en failed sin lanzar excepción', async () => {
    const op = baseOp({ tipo: 'update_item', equipoId: 5, intentos: 0 });
    mockQueue([op]);
    // Preferences.get para REV_KEY(5) devuelve { value: null } por el mockImplementation por defecto

    await expect(service.sync()).resolves.not.toThrow();

    const setCalls = (Preferences.set as ReturnType<typeof vi.fn>).mock.calls;
    const queueGuardada = JSON.parse(setCalls.at(-1)![0].value);
    expect(queueGuardada).toHaveLength(1);
    expect(queueGuardada[0].id).toBe('op1');
    expect(queueGuardada[0].intentos).toBe(0); // no se incrementa: no hubo excepción, fue un "no resuelto"
  });

  it('operación que falla con intentos < 5 vuelve a la cola con intentos + 1', async () => {
    const op = baseOp({ tipo: 'create_revision', equipoId: 5, intentos: 3, payload: {} });
    mockQueue([op]);
    api.get.mockReturnValue(throwError(() => new Error('network error')));

    await service.sync();

    const setCalls = (Preferences.set as ReturnType<typeof vi.fn>).mock.calls;
    const ultimaQueue = JSON.parse(setCalls.at(-1)![0].value);
    expect(ultimaQueue).toHaveLength(1);
    expect(ultimaQueue[0].intentos).toBe(4);
  });

  it('operación que falla con intentos >= 5 se descarta de la cola', async () => {
    const op = baseOp({ tipo: 'create_revision', equipoId: 5, intentos: 4, payload: {} });
    mockQueue([op]);
    api.get.mockReturnValue(throwError(() => new Error('network error')));

    await service.sync();

    const setCalls = (Preferences.set as ReturnType<typeof vi.fn>).mock.calls;
    const ultimaQueue = JSON.parse(setCalls.at(-1)![0].value);
    expect(ultimaQueue).toHaveLength(0);
  });

  it('resolveRevId prioriza revMap sobre el cache de Preferences', async () => {
    const revMap = new Map<number, number>([[5, 999]]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const revId = await (service as any).resolveRevId(5, revMap);

    expect(revId).toBe(999);
    expect(Preferences.get).not.toHaveBeenCalled();
  });

  it('resolveRevId cae al cache de Preferences si no está en revMap', async () => {
    const revMap = new Map<number, number>();
    (Preferences.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      value: JSON.stringify({ id: 111, equipo_id: 5 }),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const revId = await (service as any).resolveRevId(5, revMap);

    expect(revId).toBe(111);
    expect(Preferences.get).toHaveBeenCalledWith({ key: REV_KEY(5) });
  });
});
