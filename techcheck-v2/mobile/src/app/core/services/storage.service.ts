import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

const KEYS = {
  accessToken:  'tc_access_token',
  refreshToken: 'tc_refresh_token',
} as const;

// Usa @capacitor/preferences (EncryptedSharedPreferences en Android) en lugar
// de localStorage para que los tokens no queden en texto plano en el sistema de archivos.
@Injectable({ providedIn: 'root' })
export class StorageService {
  // Sincrónico: devuelve el valor cacheado en memoria (se carga al init)
  private _accessToken:  string | null = null;
  private _refreshToken: string | null = null;

  async init(): Promise<void> {
    const [a, r] = await Promise.all([
      Preferences.get({ key: KEYS.accessToken }),
      Preferences.get({ key: KEYS.refreshToken }),
    ]);
    this._accessToken  = a.value;
    this._refreshToken = r.value;
  }

  getAccessToken():  string | null { return this._accessToken; }
  getRefreshToken(): string | null { return this._refreshToken; }

  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    this._accessToken  = accessToken;
    this._refreshToken = refreshToken;
    await Promise.all([
      Preferences.set({ key: KEYS.accessToken,  value: accessToken }),
      Preferences.set({ key: KEYS.refreshToken, value: refreshToken }),
    ]);
  }

  async clearTokens(): Promise<void> {
    this._accessToken  = null;
    this._refreshToken = null;
    await Promise.all([
      Preferences.remove({ key: KEYS.accessToken }),
      Preferences.remove({ key: KEYS.refreshToken }),
    ]);
  }
}
