import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResponse, Tecnico, TecnicoForm, Revision, RevisionForm, TareaProgramada, TareaForm, DashboardStats, GrupoElemento, ElementoGrupo } from '../models/models';

@Injectable({ providedIn: 'root' })
export class TecnicosService {
  private url = `${environment.apiUrl}/tecnicos`;
  constructor(private http: HttpClient) {}

  getAll(): Observable<Tecnico[]> {
    return this.http.get<ApiResponse<Tecnico[]>>(this.url).pipe(map(r => r.data || []));
  }

  create(form: TecnicoForm): Observable<Tecnico> {
    return this.http.post<ApiResponse<Tecnico>>(this.url, form).pipe(map(r => r.data!));
  }

  update(id: string, form: Partial<TecnicoForm>): Observable<Tecnico> {
    return this.http.put<ApiResponse<Tecnico>>(`${this.url}/${id}`, form).pipe(map(r => r.data!));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.url}/${id}`).pipe(map(() => void 0));
  }
}

@Injectable({ providedIn: 'root' })
export class RevisionesService {
  private url = `${environment.apiUrl}/revisiones`;
  constructor(private http: HttpClient) {}

  getAll(filtros?: { equipoId?: string; tecnicoId?: string; estado?: string }): Observable<Revision[]> {
    let params: any = {};
    if (filtros?.equipoId) params['equipoId'] = filtros.equipoId;
    if (filtros?.tecnicoId) params['tecnicoId'] = filtros.tecnicoId;
    if (filtros?.estado) params['estado'] = filtros.estado;
    return this.http.get<ApiResponse<Revision[]>>(this.url, { params }).pipe(map(r => r.data || []));
  }

  getById(id: string): Observable<Revision> {
    return this.http.get<ApiResponse<Revision>>(`${this.url}/${id}`).pipe(map(r => r.data!));
  }

  create(form: RevisionForm): Observable<Revision> {
    return this.http.post<ApiResponse<Revision>>(this.url, form).pipe(map(r => r.data!));
  }

  update(id: string, form: Partial<RevisionForm>): Observable<Revision> {
    return this.http.put<ApiResponse<Revision>>(`${this.url}/${id}`, form).pipe(map(r => r.data!));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.url}/${id}`).pipe(map(() => void 0));
  }
}

@Injectable({ providedIn: 'root' })
export class TareasService {
  private url = `${environment.apiUrl}/tareas`;
  constructor(private http: HttpClient) {}

  getAll(): Observable<TareaProgramada[]> {
    return this.http.get<ApiResponse<TareaProgramada[]>>(this.url).pipe(map(r => r.data || []));
  }

  create(form: TareaForm): Observable<TareaProgramada> {
    return this.http.post<ApiResponse<TareaProgramada>>(this.url, form).pipe(map(r => r.data!));
  }

  update(id: string, form: Partial<TareaForm>): Observable<TareaProgramada> {
    return this.http.put<ApiResponse<TareaProgramada>>(`${this.url}/${id}`, form).pipe(map(r => r.data!));
  }

  toggle(id: string): Observable<TareaProgramada> {
    return this.http.put<ApiResponse<TareaProgramada>>(`${this.url}/${id}/toggle`, {}).pipe(map(r => r.data!));
  }

  deleteTarea(id: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.url}/${id}`).pipe(map(() => void 0));
  }
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private url = `${environment.apiUrl}/dashboard`;
  constructor(private http: HttpClient) {}

  getStats(): Observable<DashboardStats> {
    return this.http.get<ApiResponse<DashboardStats>>(this.url).pipe(map(r => r.data!));
  }
}

@Injectable({ providedIn: 'root' })
export class ExportarService {
  private url = `${environment.apiUrl}/exportar`;
  constructor(private http: HttpClient) {}

  exportarCSV(proyectoId?: string): void {
    const params = proyectoId ? `?proyectoId=${proyectoId}` : '';
    window.location.href = `${this.url}/revisiones-csv${params}`;
  }

  exportarJSON(): void {
    window.location.href = `${this.url}/json`;
  }

  importarJSON(file: File): Observable<{ proyectos: number; equipos: number; plantillas: number; tecnicos: number; revisiones: number; tareas: number }> {
    return new Observable(obs => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target!.result as string);
          this.http.post<ApiResponse<any>>(`${this.url}/importar-json`, data, {
            headers: { 'Content-Type': 'application/json' }
          }).pipe(map(r => r.data!)).subscribe({
            next: v => { obs.next(v); obs.complete(); },
            error: err => obs.error(err)
          });
        } catch {
          obs.error(new Error('Archivo JSON inválido'));
        }
      };
      reader.onerror = () => obs.error(new Error('Error leyendo el archivo'));
      reader.readAsText(file);
    });
  }
}

@Injectable({ providedIn: 'root' })
export class CatalogosService {
  private url = `${environment.apiUrl}/catalogos`;
  constructor(private http: HttpClient) {}

  getAll(): Observable<GrupoElemento[]> {
    return this.http.get<ApiResponse<GrupoElemento[]>>(this.url).pipe(map(r => r.data || []));
  }

  createGrupo(data: { nombre: string; descripcion?: string }): Observable<GrupoElemento> {
    return this.http.post<ApiResponse<GrupoElemento>>(this.url, data).pipe(map(r => r.data!));
  }

  updateGrupo(id: string, data: Partial<{ nombre: string; descripcion: string; activo: boolean }>): Observable<GrupoElemento> {
    return this.http.put<ApiResponse<GrupoElemento>>(`${this.url}/${id}`, data).pipe(map(r => r.data!));
  }

  deleteGrupo(id: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.url}/${id}`).pipe(map(() => void 0));
  }

  createElemento(grupoId: string, data: { valor: string; descripcion?: string }): Observable<ElementoGrupo> {
    return this.http.post<ApiResponse<ElementoGrupo>>(`${this.url}/${grupoId}/elementos`, data).pipe(map(r => r.data!));
  }

  updateElemento(grupoId: string, id: string, data: Partial<{ valor: string; descripcion: string; activo: boolean }>): Observable<ElementoGrupo> {
    return this.http.put<ApiResponse<ElementoGrupo>>(`${this.url}/${grupoId}/elementos/${id}`, data).pipe(map(r => r.data!));
  }

  deleteElemento(grupoId: string, id: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.url}/${grupoId}/elementos/${id}`).pipe(map(() => void 0));
  }
}