import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpContext, HttpContextToken, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, timeout, TimeoutError } from 'rxjs';
import { idb, CacheEntry, OutboxEntry, STORE_CACHE, STORE_OUTBOX } from './idb';

/** Las peticiones marcadas con este token no pasan por la lógica offline (las usa la sincronización). */
export const SIN_OFFLINE = new HttpContextToken<boolean>(() => false);

const USUARIO_OFFLINE_KEY = 'tc_offline_user';
const ESTADOS_EQUIPOS = ['pendiente', 'en_proceso', 'terminado', 'archivado', 'tareas_programadas'];

export interface UsuarioOffline {
  user: { id: string; nombre: string; username: string; rol: any };
  permisos: string[];
}

export function esErrorDeRed(err: unknown): boolean {
  if (err instanceof TimeoutError) return true;
  if (err instanceof HttpErrorResponse) return err.status === 0 || err.status === 504;
  return false;
}

export function nuevoId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

@Injectable({ providedIn: 'root' })
export class OfflineService {
  private http = inject(HttpClient);

  readonly enLinea = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
  readonly sincronizando = signal(false);
  readonly outbox = signal<OutboxEntry[]>([]);
  readonly ultimaDescarga = signal<string | null>(null);
  readonly aviso = signal<{ texto: string; tipo: 'info' | 'ok' | 'error' } | null>(null);

  readonly pendientes = computed(() => this.outbox().filter(e => !e.fallido));
  readonly fallidos = computed(() => this.outbox().filter(e => e.fallido));

  private avisoTimer: any = null;
  private descargando = false;

  constructor() {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', () => this.verificarConexion());
    window.addEventListener('offline', () => this.enLinea.set(false));
    setInterval(() => {
      if (!this.enLinea() || this.pendientes().length) this.verificarConexion();
    }, 30000);
    this.cargarEstadoUsuario();
  }

  // ── Usuario ───────────────────────────────────────────────────────────────

  usuarioOffline(): UsuarioOffline | null {
    try {
      const raw = localStorage.getItem(USUARIO_OFFLINE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  recordarUsuario(user: UsuarioOffline['user'], permisos: string[]) {
    try { localStorage.setItem(USUARIO_OFFLINE_KEY, JSON.stringify({ user, permisos })); } catch {}
    this.cargarEstadoUsuario();
  }

  olvidarUsuario() {
    try { localStorage.removeItem(USUARIO_OFFLINE_KEY); } catch {}
    this.outbox.set([]);
    this.ultimaDescarga.set(null);
  }

  private userId(): string {
    return this.usuarioOffline()?.user.id || '';
  }

  private cargarEstadoUsuario() {
    const uid = this.userId();
    try { this.ultimaDescarga.set(uid ? localStorage.getItem(`tc_ultima_descarga_${uid}`) : null); } catch {}
    this.refrescarOutbox();
  }

  // ── Conexión ──────────────────────────────────────────────────────────────

  marcarSinConexion() {
    this.enLinea.set(false);
  }

  marcarEnLinea() {
    if (this.enLinea()) return;
    this.enLinea.set(true);
    this.sincronizar();
  }

  async verificarConexion(): Promise<boolean> {
    try {
      await firstValueFrom(this.http.get('/api/health', { context: new HttpContext().set(SIN_OFFLINE, true) }).pipe(timeout(6000)));
      if (!this.enLinea()) this.enLinea.set(true);
      await this.sincronizar();
      return true;
    } catch {
      this.enLinea.set(false);
      return false;
    }
  }

  avisar(texto: string, tipo: 'info' | 'ok' | 'error' = 'info') {
    this.aviso.set({ texto, tipo });
    clearTimeout(this.avisoTimer);
    this.avisoTimer = setTimeout(() => this.aviso.set(null), 5000);
  }

  // ── Caché de lecturas ─────────────────────────────────────────────────────

  async guardarCache(url: string, body: unknown) {
    const uid = this.userId();
    if (!uid) return;
    const entry: CacheEntry = { key: `${uid}|${url}`, url, userId: uid, body, guardadoEn: new Date().toISOString() };
    try { await idb.put(STORE_CACHE, entry); } catch {}
  }

  async leerCache(url: string): Promise<unknown | undefined> {
    const uid = this.userId();
    if (!uid) return undefined;
    try { return (await idb.get<CacheEntry>(STORE_CACHE, `${uid}|${url}`))?.body; } catch { return undefined; }
  }

  /** Refleja una revisión guardada sin conexión en los listados de equipos guardados. Devuelve el nombre del equipo. */
  private async parcharEquipoEnCache(equipoId: string, revision: any): Promise<string> {
    const uid = this.userId();
    let nombre = '';
    const entradas = (await idb.getAll<CacheEntry>(STORE_CACHE)).filter(e => e.userId === uid && /\/equipos/.test(e.url));
    for (const entrada of entradas) {
      const body: any = entrada.body;
      const data = body?.data;
      let cambio = false;
      const parchar = (e: any) => {
        if (e?.id !== equipoId) return e;
        cambio = true;
        nombre = e.nombre || nombre;
        const previa = e.ultimaRevision?.id === revision.id ? e.ultimaRevision : {};
        return { ...e, ultimaRevision: { ...previa, ...revision, creadoEn: previa.creadoEn || revision.creadoEn } };
      };
      const nuevaData = Array.isArray(data) ? data.map(parchar) : parchar(data);
      if (cambio) await idb.put(STORE_CACHE, { ...entrada, body: { ...body, data: nuevaData } });
    }
    return nombre;
  }

  // ── Cola de cambios pendientes ────────────────────────────────────────────

  async refrescarOutbox() {
    const uid = this.userId();
    try {
      const todos = await idb.getAll<OutboxEntry>(STORE_OUTBOX);
      this.outbox.set(todos.filter(e => e.userId === uid).sort((a, b) => (a.id || 0) - (b.id || 0)));
    } catch { this.outbox.set([]); }
  }

  hayPendientes(): boolean {
    return this.pendientes().length > 0;
  }

  async encolarRevision(method: 'POST' | 'PUT', url: string, body: any): Promise<any> {
    const uid = this.userId();
    const revisionId: string = method === 'POST' ? body.id : url.split('/').pop()!;
    const ahora = new Date().toISOString();
    const revision = { ...body, id: revisionId, creadoEn: body.creadoEn || ahora, actualizadoEn: ahora, pendienteSync: true };
    const nombre = body.equipoId ? await this.parcharEquipoEnCache(body.equipoId, revision) : '';

    const existentes = (await idb.getAll<OutboxEntry>(STORE_OUTBOX)).filter(e => e.userId === uid && !e.fallido);
    const previa = existentes.find(e =>
      (e.method === 'POST' && e.body?.id === revisionId) || (e.method === 'PUT' && e.url === url));

    if (previa) {
      await idb.put(STORE_OUTBOX, { ...previa, body: { ...previa.body, ...body, id: previa.body.id }, creadoEn: previa.creadoEn });
    } else {
      const entry: OutboxEntry = {
        userId: uid, method, url, body, equipoId: body.equipoId,
        descripcion: `Revisión${nombre ? ' de ' + nombre : ''}`,
        creadoEn: ahora, intentos: 0,
      };
      await idb.put(STORE_OUTBOX, entry);
    }
    await this.refrescarOutbox();
    return revision;
  }

  async descartar(entry: OutboxEntry) {
    if (entry.id == null) return;
    await idb.delete(STORE_OUTBOX, entry.id);
    await this.refrescarOutbox();
  }

  async sincronizar() {
    if (this.sincronizando() || !this.userId()) return;
    await this.refrescarOutbox();
    const cola = this.pendientes();
    if (!cola.length) return;

    this.sincronizando.set(true);
    let subidos = 0;
    try {
      for (const entry of cola) {
        try {
          const body = await this.subirArchivosPendientes(entry.body);
          await firstValueFrom(this.http.request(entry.method, entry.url, {
            body, context: new HttpContext().set(SIN_OFFLINE, true),
          }).pipe(timeout(60000)));
          await idb.delete(STORE_OUTBOX, entry.id!);
          subidos++;
        } catch (err) {
          if (esErrorDeRed(err)) { this.enLinea.set(false); break; }
          const status = err instanceof HttpErrorResponse ? err.status : 0;
          const mensaje = err instanceof HttpErrorResponse ? (err.error?.message || err.message) : String(err);
          if (status === 401) break;
          const definitivo = status >= 400 && status < 500;
          await idb.put(STORE_OUTBOX, { ...entry, intentos: entry.intentos + 1, error: mensaje, fallido: definitivo || entry.intentos + 1 >= 5 });
          if (!definitivo) break;
        }
      }
    } finally {
      this.sincronizando.set(false);
      await this.refrescarOutbox();
    }

    if (subidos) {
      this.avisar(subidos === 1 ? 'Se subió 1 cambio que estaba pendiente.' : `Se subieron ${subidos} cambios que estaban pendientes.`, 'ok');
      this.descargarDatos();
    }
    if (this.fallidos().length) this.avisar('Hay cambios que no se pudieron subir. Revísalos en el aviso de sincronización.', 'error');
  }

  /** Sube las fotos tomadas sin conexión (guardadas en base64) y las reemplaza por su referencia en el servidor. */
  private async subirArchivosPendientes(valor: any): Promise<any> {
    if (Array.isArray(valor)) return Promise.all(valor.map(v => this.subirArchivosPendientes(v)));
    if (!valor || typeof valor !== 'object') return valor;
    if (typeof valor.data === 'string' && valor.data.startsWith('data:') && valor.pendienteSubir) {
      const res: any = await firstValueFrom(this.http.post('/api/archivos',
        { nombre: valor.nombre, tipo: valor.tipo, data: valor.data, proyectoId: valor.proyectoId || undefined },
        { context: new HttpContext().set(SIN_OFFLINE, true) }).pipe(timeout(120000)));
      return res.data;
    }
    const salida: any = {};
    for (const [k, v] of Object.entries(valor)) salida[k] = await this.subirArchivosPendientes(v);
    return salida;
  }

  // ── Descarga para uso sin conexión ────────────────────────────────────────

  async descargarDatos() {
    if (this.descargando || !this.userId()) return;
    this.descargando = true;
    const get = (url: string) => firstValueFrom(this.http.get<any>(url).pipe(timeout(30000)));
    try {
      const proyectos = (await get('/api/proyectos'))?.data || [];
      const peticiones: Promise<unknown>[] = [
        get('/api/catalogos'),
        get('/api/plantillas'),
        get('/api/auth/me'),
        get('/api/auth/mis-permisos'),
        get('/api/tecnicos'),
      ];
      for (const p of proyectos) {
        peticiones.push(get(`/api/proyectos/${p.id}`));
        peticiones.push(get(`/api/proyectos/${p.id}/tareas-no-cumplidas`));
        for (const estado of ESTADOS_EQUIPOS) peticiones.push(get(`/api/proyectos/${p.id}/equipos?estado=${estado}`));
      }
      const resultados = await Promise.allSettled(peticiones);
      if (resultados.every(r => r.status === 'fulfilled' || !esErrorDeRed(r.reason))) {
        const ahora = new Date().toISOString();
        this.ultimaDescarga.set(ahora);
        try { localStorage.setItem(`tc_ultima_descarga_${this.userId()}`, ahora); } catch {}
      }
    } catch {
      // Sin conexión: se conserva la última descarga.
    } finally {
      this.descargando = false;
    }
  }
}
