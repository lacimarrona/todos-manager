import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, from, tap, catchError, switchMap, EMPTY, share } from 'rxjs';
import { Preferences } from '@capacitor/preferences';
import { environment } from '../../../environments/environment';
import { StorageService } from './storage.service';
import { User } from '../models/user.model';
import { LoginRequest, LoginResponse, RefreshResponse, JwtPayload } from '../models/auth.model';

const USER_CACHE_KEY  = 'tc_user_cache';
const LOCAL_AUTH_KEY  = 'tc_local_auth';

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http      = inject(HttpClient);
  private readonly router    = inject(Router);
  private readonly storage   = inject(StorageService);
  private readonly base      = `${environment.apiUrl}/auth`;

  private readonly _user = signal<User | null>(null);
  // Observable compartido para deduplicar llamadas simultáneas de refresh
  private _refreshInProgress$: Observable<RefreshResponse> | null = null;

  readonly user     = this._user.asReadonly();
  readonly isLogged = computed(() => this._user() !== null);
  readonly role     = computed(() => this._user()?.rol ?? null);
  readonly isSuperAdmin = computed(() => this._user()?.rol === 'superadmin');
  readonly isAdmin  = computed(() => ['admin', 'superadmin'].includes(this._user()?.rol ?? ''));

  login(creds: LoginRequest) {
    return this.http.post<LoginResponse>(`${this.base}/login`, creds).pipe(
      switchMap(async res => {
        await this.storage.setTokens(res.access_token, res.refresh_token);
        const hash = await sha256(`${creds.email}:${creds.password}`);
        await Preferences.set({ key: LOCAL_AUTH_KEY, value: hash });
      }),
      switchMap(() => this.loadMe()),
    );
  }

  async loginOffline(email: string, password: string): Promise<boolean> {
    const { value: savedHash } = await Preferences.get({ key: LOCAL_AUTH_KEY });
    if (!savedHash) return false;
    const hash = await sha256(`${email}:${password}`);
    if (hash !== savedHash) return false;
    return (await this.loadMeFromCache()) !== null;
  }

  loadMe() {
    return this.http.get<User>(`${this.base}/me`).pipe(
      tap(user => {
        this._user.set(user);
        // Guardar en caché para acceso offline futuro
        Preferences.set({ key: USER_CACHE_KEY, value: JSON.stringify(user) });
      }),
    );
  }

  async loadMeFromCache(): Promise<User | null> {
    const { value } = await Preferences.get({ key: USER_CACHE_KEY });
    if (!value) return null;
    try {
      const user = JSON.parse(value) as User;
      // Cuenta desactivada por admin: no permitir sesión offline
      if (user.activo === false) return null;
      this._user.set(user);
      return user;
    } catch { return null; }
  }

  refresh(): Observable<RefreshResponse> {
    const refreshToken = this.storage.getRefreshToken();
    if (!refreshToken) return EMPTY;

    if (this._refreshInProgress$) return this._refreshInProgress$;

    this._refreshInProgress$ = this.http
      .post<RefreshResponse>(`${this.base}/refresh`, { refresh_token: refreshToken })
      .pipe(
        switchMap(async res => {
          await this.storage.setTokens(res.access_token, res.refresh_token);
          return res;
        }),
        share(),
      );

    this._refreshInProgress$.subscribe({
      error: () => { this._refreshInProgress$ = null; },
      complete: () => { this._refreshInProgress$ = null; },
    });

    return this._refreshInProgress$;
  }

  logout() {
    const refreshToken = this.storage.getRefreshToken();
    const req$ = refreshToken
      ? this.http.post(`${this.base}/logout`, { refresh_token: refreshToken })
      : EMPTY;

    return req$.pipe(
      catchError(() => EMPTY),
      switchMap(() => from(this._clearSession())),
    );
  }

  switchWorkspace(workspaceId: number) {
    const currentRefresh = this.storage.getRefreshToken() ?? '';
    return this.http.post<{ access_token: string; token_type: string }>(
      `${this.base}/switch-workspace`,
      { workspace_id: workspaceId },
    ).pipe(
      switchMap(res => from(this.storage.setTokens(res.access_token, currentRefresh))),
      switchMap(() => this.loadMe()),
    );
  }

  changePassword(passwordActual: string, passwordNuevo: string) {
    return this.http.post(`${this.base}/change-password`, { password_actual: passwordActual, password_nuevo: passwordNuevo });
  }

  clearSession() {
    void this._clearSession();
  }

  decodeToken(): JwtPayload | null {
    const token = this.storage.getAccessToken();
    if (!token) return null;
    try {
      const payload = token.split('.')[1];
      return JSON.parse(atob(payload)) as JwtPayload;
    } catch {
      return null;
    }
  }

  isTokenExpired(): boolean {
    const payload = this.decodeToken();
    if (!payload) return true;
    return Date.now() >= payload.exp * 1000;
  }

  private async _clearSession(): Promise<void> {
    await this.storage.clearTokens();
    await Promise.all([
      Preferences.remove({ key: USER_CACHE_KEY }),
      Preferences.remove({ key: LOCAL_AUTH_KEY }),
    ]);
    this._user.set(null);
    this.router.navigate(['/auth/login']);
  }
}
