import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResponse, ArchivoAdjunto } from '../models/models';

@Injectable({ providedIn: 'root' })
export class ArchivosService {
  private url = `${environment.apiUrl}/archivos`;
  constructor(private http: HttpClient) {}

  subir(nombre: string, tipo: string, data: string): Observable<ArchivoAdjunto> {
    return this.http.post<ApiResponse<ArchivoAdjunto>>(this.url, { nombre, tipo, data })
      .pipe(map(r => r.data!));
  }
}
