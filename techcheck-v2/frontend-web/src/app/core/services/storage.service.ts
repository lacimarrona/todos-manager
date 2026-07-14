import { Injectable } from '@angular/core';

const ACCESS_KEY = 'tc_access_token';

@Injectable({ providedIn: 'root' })
export class StorageService {
  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  }

  // El refresh_token ya no se guarda en localStorage — vive en la cookie httpOnly
  // que el servidor gestiona automáticamente.
  setTokens(accessToken: string, _refreshToken?: string): void {
    localStorage.setItem(ACCESS_KEY, accessToken);
  }

  clearTokens(): void {
    localStorage.removeItem(ACCESS_KEY);
  }
}
