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
  
  getEquiposFiltrados(proyectoId: string, estado: string): Observable<Equipo[]> {
  return this.http.get<ApiResponse<Equipo[]>>(`${this.url}/${proyectoId}/equipos?estado=${estado}`).pipe(map(r => r.data || []));
}

exportarProyecto(proyectoId: string): Observable<any> {
  return this.http.get<any>(`${this.url}/${proyectoId}/exportar`).pipe(map(r => r.data));
}

exportarProyectoZip(proyectoId: string): Observable<Blob> {
  return this.http.get(`${this.url}/${proyectoId}/exportar-zip`, { responseType: 'blob' });
}

importarProyecto(datos: any): Observable<Proyecto> {
  return this.http.post<ApiResponse<Proyecto>>(`${this.url}/importar`, datos).pipe(map(r => r.data!));
}

importarProyectoZip(archivo: File): Observable<Proyecto> {
  const form = new FormData();
  form.append('archivo', archivo);
  return this.http.post<ApiResponse<Proyecto>>(`${this.url}/importar-zip`, form).pipe(map(r => r.data!));
}

restaurarBackup(archivo: File): Observable<{importados: number, archivosImportados: number, proyectosImportados: string[], mensaje: string}> {
  const form = new FormData();
  form.append('archivo', archivo);
  return this.http.post<ApiResponse<any>>(`${this.url}/restaurar-backup`, form).pipe(map(r => r.data!));
}
}