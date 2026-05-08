import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResponse, Equipo, EquipoForm } from '../models/models';

@Injectable({ providedIn: 'root' })
export class EquiposService {
  private url = `${environment.apiUrl}/equipos`;
  constructor(private http: HttpClient) {}

  getAll(): Observable<Equipo[]> {
    return this.http.get<ApiResponse<Equipo[]>>(this.url).pipe(map(r => r.data || []));
  }

  getById(id: string): Observable<Equipo> {
    return this.http.get<ApiResponse<Equipo>>(`${this.url}/${id}`).pipe(map(r => r.data!));
  }

  create(form: EquipoForm): Observable<Equipo> {
    return this.http.post<ApiResponse<Equipo>>(this.url, form).pipe(map(r => r.data!));
  }

  update(id: string, form: Partial<EquipoForm>): Observable<Equipo> {
    return this.http.put<ApiResponse<Equipo>>(`${this.url}/${id}`, form).pipe(map(r => r.data!));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.url}/${id}`).pipe(map(() => void 0));
  }
}