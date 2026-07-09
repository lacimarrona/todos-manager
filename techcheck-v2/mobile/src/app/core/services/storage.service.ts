import { Injectable } from '@angular/core';

const KEYS = {
  accessToken:  'tc_access_token',
  refreshToken: 'tc_refresh_token',
} as const;

@Injectable({ providedIn: 'root' })
export class StorageService {
  getAccessToken(): string | null {
    return localStorage.getItem(KEYS.accessToken);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(KEYS.refreshToken);
  }

  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(KEYS.accessToken, accessToken);
    localStorage.setItem(KEYS.refreshToken, refreshToken);
  }

  clearTokens(): void {
    localStorage.removeItem(KEYS.accessToken);
    localStorage.removeItem(KEYS.refreshToken);
  }
}
