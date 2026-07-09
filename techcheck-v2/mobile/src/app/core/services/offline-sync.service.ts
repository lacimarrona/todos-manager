import { Injectable, inject, signal } from '@angular/core';
import { Network } from '@capacitor/network';
import { Preferences } from '@capacitor/preferences';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { Revision } from '../models/revision.model';
import { Equipo, ItemEquipo } from '../models/equipo.model';

export type TipoOp =
  | 'create_revision'
  | 'update_item'
  | 'add_archivo'
  | 'complete_revision';

export interface PendingOp {
  id: string;
  tipo: TipoOp;
  equipoId: number;
  payload: Record<string, unknown>;
  timestamp: number;
  intentos: number;
}

const QUEUE_KEY   = 'tc_queue';
const REV_KEY     = (eid: number) => `tc_rev_${eid}`;
const EQ_KEY      = (pid: number) => `tc_eq_${pid}`;
const ITEMS_EQ_KEY = (eid: number) => `tc_items_eq_${eid}`;

@Injectable({ providedIn: 'root' })
export class OfflineSyncService {
  private readonly api = inject(ApiService);

  readonly online        = signal(true);
  readonly sincronizando = signal(false);
  readonly pendientes    = signal(0);

  async init() {
    const s = await Network.getStatus();
    this.online.set(s.connected);
    await this.refreshCount();

    Network.addListener('networkStatusChange', async st => {
      const eraOffline = !this.online();
      this.online.set(st.connected);
      if (st.connected && eraOffline) {
        setTimeout(() => this.sync(), 1500);
      }
    });
  }

  // ── Cache de revisiones ──────────────────────────────────────────────────────

  async cacheRevision(rev: Revision) {
    await Preferences.set({ key: REV_KEY(rev.equipo_id), value: JSON.stringify(rev) });
  }

  async getRevisionCache(equipoId: number): Promise<Revision | null> {
    const { value } = await Preferences.get({ key: REV_KEY(equipoId) });
    if (!value) return null;
    try { return JSON.parse(value) as Revision; } catch { return null; }
  }

  async cacheEquipos(proyectoId: number, equipos: Equipo[]) {
    await Preferences.set({ key: EQ_KEY(proyectoId), value: JSON.stringify(equipos) });
  }

  async getEquiposCache(proyectoId: number): Promise<Equipo[] | null> {
    const { value } = await Preferences.get({ key: EQ_KEY(proyectoId) });
    if (!value) return null;
    try { return JSON.parse(value) as Equipo[]; } catch { return null; }
  }

  async cacheItemsEquipo(equipoId: number, items: ItemEquipo[]) {
    await Preferences.set({ key: ITEMS_EQ_KEY(equipoId), value: JSON.stringify(items) });
  }

  async getItemsEquipoCache(equipoId: number): Promise<ItemEquipo[] | null> {
    const { value } = await Preferences.get({ key: ITEMS_EQ_KEY(equipoId) });
    if (!value) return null;
    try { return JSON.parse(value) as ItemEquipo[]; } catch { return null; }
  }

  // ── Cola de operaciones ──────────────────────────────────────────────────────

  async encolar(op: Omit<PendingOp, 'id' | 'timestamp' | 'intentos'>) {
    const q = await this.getQueue();
    q.push({
      ...op,
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      intentos: 0,
    });
    await this.saveQueue(q);
  }

  private async getQueue(): Promise<PendingOp[]> {
    const { value } = await Preferences.get({ key: QUEUE_KEY });
    return value ? JSON.parse(value) : [];
  }

  private async saveQueue(q: PendingOp[]) {
    await Preferences.set({ key: QUEUE_KEY, value: JSON.stringify(q) });
    this.pendientes.set(q.length);
  }

  private async refreshCount() {
    const q = await this.getQueue();
    this.pendientes.set(q.length);
  }

  // ── Sincronización ───────────────────────────────────────────────────────────

  async sync() {
    if (this.sincronizando() || !this.online()) return;
    const queue = await this.getQueue();
    if (!queue.length) return;

    this.sincronizando.set(true);
    const failed: PendingOp[] = [];

    // Ordenar por timestamp para procesar en orden cronológico
    const sorted = [...queue].sort((a, b) => a.timestamp - b.timestamp);

    // Mapa equipoId → revisionId (resuelto durante esta sync)
    const revMap = new Map<number, number>();

    for (const op of sorted) {
      try {
        switch (op.tipo) {

          case 'create_revision': {
            // Si ya hay revisión en progreso para este equipo, usarla
            const lista = await firstValueFrom(
              this.api.get<{ id: number; estado: string }[]>(`/equipos/${op.equipoId}/revisiones`)
            );
            const activa = lista.find(r => r.estado !== 'terminado');
            if (activa) {
              revMap.set(op.equipoId, activa.id);
            } else {
              const rev = await firstValueFrom(
                this.api.post<Revision>('/revisiones', op.payload)
              );
              revMap.set(op.equipoId, rev.id);
              await this.cacheRevision(rev);
            }
            break;
          }

          case 'update_item': {
            const revId = await this.resolveRevId(op.equipoId, revMap);
            if (!revId) { failed.push(op); break; }

            const { itemEquipoId, ...dto } = op.payload as {
              itemEquipoId: number; checked?: boolean; nota?: string | null;
            };
            const rev = await firstValueFrom(this.api.get<Revision>(`/revisiones/${revId}`));
            const item = rev.items.find(i => i.item_id === itemEquipoId);
            if (item) {
              await firstValueFrom(
                this.api.put(`/revisiones/${revId}/items/${item.id}`, dto)
              );
            }
            break;
          }

          case 'add_archivo': {
            const revId = await this.resolveRevId(op.equipoId, revMap);
            if (!revId) { failed.push(op); break; }

            const { itemEquipoId, url, tipo } = op.payload as {
              itemEquipoId: number; url: string; tipo: string;
            };
            const rev = await firstValueFrom(this.api.get<Revision>(`/revisiones/${revId}`));
            const item = rev.items.find(i => i.item_id === itemEquipoId);
            if (item) {
              await firstValueFrom(
                this.api.post(`/revisiones/${revId}/items/${item.id}/archivos`, { url, tipo })
              );
            }
            break;
          }

          case 'complete_revision': {
            const revId = await this.resolveRevId(op.equipoId, revMap);
            if (!revId) { failed.push(op); break; }
            const rev = await firstValueFrom(
              this.api.put<Revision>(`/revisiones/${revId}`, op.payload)
            );
            await this.cacheRevision(rev);
            break;
          }
        }
      } catch {
        op.intentos += 1;
        if (op.intentos < 5) failed.push(op);
      }
    }

    await this.saveQueue(failed);
    this.sincronizando.set(false);
  }

  private async resolveRevId(equipoId: number, revMap: Map<number, number>): Promise<number | null> {
    if (revMap.has(equipoId)) return revMap.get(equipoId)!;
    const cached = await this.getRevisionCache(equipoId);
    if (cached && cached.id > 0) {
      revMap.set(equipoId, cached.id);
      return cached.id;
    }
    return null;
  }
}
