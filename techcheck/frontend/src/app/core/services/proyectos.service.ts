import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResponse, Proyecto, ProyectoForm, Equipo } from '../models/models';

@Injectable({ providedIn: 'root' })
export class ProyectosService {
  private url = `${environment.apiUrl}/proyectos`;
  constructor(private http: HttpClient) {}

  getAll(): Observable<Proyecto[]> {
    return this.http.get<ApiResponse<Proyecto[]>>(this.url).pipe(map(r => r.data || []));
  }

  getById(id: string): Observable<Proyecto> {
    return this.http.get<ApiResponse<Proyecto>>(`${this.url}/${id}`).pipe(map(r => r.data!));
  }

  getEquipos(proyectoId: string): Observable<Equipo[]> {
    return this.http.get<ApiResponse<Equipo[]>>(`${this.url}/${proyectoId}/equipos`).pipe(map(r => r.data || []));
  }

  getTodosEquipos(proyectoId: string): Observable<Equipo[]> {
  return this.http.get<ApiResponse<Equipo[]>>(`${this.url}/${proyectoId}/todos-equipos`).pipe(map(r => r.data || []));
}

  create(form: ProyectoForm): Observable<Proyecto> {
    return this.http.post<ApiResponse<Proyecto>>(this.url, form).pipe(map(r => r.data!));
  }

  update(id: string, form: Partial<ProyectoForm>): Observable<Proyecto> {
    return this.http.put<ApiResponse<Proyecto>>(`${this.url}/${id}`, form).pipe(map(r => r.data!));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.url}/${id}`).pipe(map(() => void 0));
  }
  
}