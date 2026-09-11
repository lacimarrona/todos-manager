import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResponse, Tecnico, TecnicoForm, Revision, RevisionForm, TareaProgramada, TareaForm, DashboardStats } from '../models/models';

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