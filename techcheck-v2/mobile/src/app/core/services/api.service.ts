import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  readonly base = environment.apiUrl;

  get<T>(path: string, params?: Record<string, string | number | boolean>) {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) httpParams = httpParams.set(k, String(v));
      });
    }
    return this.http.get<T>(`${this.base}${path}`, { params: httpParams });
  }

  post<T>(path: string, body: unknown) {
    return this.http.post<T>(`${this.base}${path}`, body);
  }

  put<T>(path: string, body: unknown) {
    return this.http.put<T>(`${this.base}${path}`, body);
  }

  patch<T>(path: string, body?: unknown) {
    return this.http.patch<T>(`${this.base}${path}`, body ?? {});
  }

  delete<T>(path: string) {
    return this.http.delete<T>(`${this.base}${path}`);
  }

  getBlob(path: string) {
    return this.http.get(`${this.base}${path}`, { responseType: 'blob' });
  }

  postForm<T>(path: string, formData: FormData) {
    return this.http.post<T>(`${this.base}${path}`, formData);
  }
}
