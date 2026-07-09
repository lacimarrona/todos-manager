import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, switchMap, EMPTY, share } from 'rxjs';
import { environment } from '../../../environments/environment';
import { StorageService } from './storage.service';
import { User } from '../models/user.model';
import { LoginRequest, LoginResponse, RefreshResponse, JwtPayload } from '../models/auth.model';

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
      tap(res => {
        this.storage.setTokens(res.access_token, res.refresh_token);
      }),
      switchMap(() => this.loadMe()),
    );
  }

  loadMe() {
    return this.http.get<User>(`${this.base}/me`).pipe(
      tap(user => this._user.set(user)),
    );
  }

  refresh(): Observable<RefreshResponse> {
    const refreshToken = this.storage.getRefreshToken();
    if (!refreshToken) return EMPTY;

    // Si ya hay un refresh en curso, reutilizar el mismo Observable
    // para evitar múltiples llamadas simultáneas con el mismo refresh token
    if (this._refreshInProgress$) return this._refreshInProgress$;

    this._refreshInProgress$ = this.http
      .post<RefreshResponse>(`${this.base}/refresh`, { refresh_token: refreshToken })
      .pipe(
        tap(res => this.storage.setTokens(res.access_token, res.refresh_token)),
        share(), // multicast para todos los suscriptores simultáneos
      );

    // Limpiar cuando el Observable termine (completado o error)
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
      tap(() => this._clearSession()),
    );
  }

  changePassword(passwordActual: string, passwordNuevo: string) {
    return this.http.post(`${this.base}/change-password`, { password_actual: passwordActual, password_nuevo: passwordNuevo });
  }

  clearSession() {
    this._clearSession();
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

  private _clearSession(): void {
    this.storage.clearTokens();
    this._user.set(null);
    this.router.navigate(['/auth/login']);
  }
}
