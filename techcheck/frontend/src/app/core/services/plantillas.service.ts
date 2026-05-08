import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResponse, Plantilla, PlantillaForm } from '../models/models';

@Injectable({ providedIn: 'root' })
export class PlantillasService {
  private url = `${environment.apiUrl}/plantillas`;
  constructor(private http: HttpClient) {}

  getAll(): Observable<Plantilla[]> {
    return this.http.get<ApiResponse<Plantilla[]>>(this.url).pipe(map(r => r.data || []));
  }

  getById(id: string): Observable<Plantilla> {
    return this.http.get<ApiResponse<Plantilla>>(`${this.url}/${id}`).pipe(map(r => r.data!));
  }

  create(form: PlantillaForm): Observable<Plantilla> {
    return this.http.post<ApiResponse<Plantilla>>(this.url, form).pipe(map(r => r.data!));
  }

  update(id: string, form: Partial<PlantillaForm>): Observable<Plantilla> {
    return this.http.put<ApiResponse<Plantilla>>(`${this.url}/${id}`, form).pipe(map(r => r.data!));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.url}/${id}`).pipe(map(() => void 0));
  }
}