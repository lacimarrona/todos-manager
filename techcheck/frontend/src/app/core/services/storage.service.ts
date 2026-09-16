import { Injectable } from '@angular/core';

const TOKEN_KEY = 'tc_at';

@Injectable({ providedIn: 'root' })
export class StorageService {
  getToken(): string | null {
    try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
  }

  setToken(token: string): void {
    try { sessionStorage.setItem(TOKEN_KEY, token); } catch {}
  }

  clearToken(): void {
    try { sessionStorage.removeItem(TOKEN_KEY); } catch {}
  }
}
