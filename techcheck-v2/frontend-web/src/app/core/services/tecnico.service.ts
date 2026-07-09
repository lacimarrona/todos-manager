import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Tecnico, TecnicoForm } from '../models/tecnico.model';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class TecnicoService {
  private readonly api = inject(ApiService);

  list(): Observable<Tecnico[]> {
    return this.api.get<Tecnico[]>('/tecnicos');
  }

  create(data: TecnicoForm): Observable<Tecnico> {
    return this.api.post<Tecnico>('/tecnicos', data);
  }

  update(id: number, data: Partial<TecnicoForm & { activo: boolean }>): Observable<Tecnico> {
    return this.api.put<Tecnico>(`/tecnicos/${id}`, data);
  }

  remove(id: number): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/tecnicos/${id}`);
  }
}
