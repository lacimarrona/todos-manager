import { Injectable } from '@angular/core';

// El access token vive en memoria (variable de instancia), no en localStorage,
// para eliminar el riesgo de XSS. El refresh_token ya estaba en cookie httpOnly.
// Consecuencia: al refrescar la pestaña se pierde el access token → el interceptor
// llama automáticamente a /refresh con la cookie httpOnly y lo renueva sin que el
// usuario note nada (salvo una petición adicional al cargar).
@Injectable({ providedIn: 'root' })
export class StorageService {
  private _accessToken: string | null = null;

  getAccessToken(): string | null {
    return this._accessToken;
  }

  setTokens(accessToken: string, _refreshToken?: string): void {
    this._accessToken = accessToken;
  }

  clearTokens(): void {
    this._accessToken = null;
  }
}
