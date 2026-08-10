import { Injectable } from '@angular/core';

// Access token stored in sessionStorage: persists across page reloads within the
// same tab but is cleared when the browser tab closes. The httpOnly refresh cookie
// is still used as fallback when sessionStorage is empty (new tab, session expiry).
const ACCESS_TOKEN_KEY = 'tc_at';

@Injectable({ providedIn: 'root' })
export class StorageService {

  getAccessToken(): string | null {
    return sessionStorage.getItem(ACCESS_TOKEN_KEY);
  }

  setTokens(accessToken: string, _refreshToken?: string): void {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  }

  clearTokens(): void {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}
