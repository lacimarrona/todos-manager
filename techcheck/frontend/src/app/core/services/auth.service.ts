import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, share, switchMap, of, map, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoginRequest, LoginResponse, Usuario, ApiResponse } from '../models/models';
import { StorageService } from './storage.service';
import { OfflineService } from '../offline/offline.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly authUrl = `${environment.apiUrl}/auth`;

  private _user = signal<Omit<Usuario, 'activo' | 'creadoEn'> | null>(null);
  private _permisos = signal<string[]>([]);

  readonly user = this._user.asReadonly();
  readonly isLogged      = computed(() => this._user() !== null);
  readonly isAdmin       = computed(() => this._user()?.rol === 'admin');
  readonly isProjectAdmin = computed(() => this._user()?.rol === 'project_admin');
  readonly isTecnico     = computed(() => this._user()?.rol === 'tecnico');
  // admin o project_admin (tienen acceso a gestión de proyectos)
  readonly canManage     = computed(() => this._user()?.rol === 'admin' || this._user()?.rol === 'project_admin');
  // Técnico con permiso de editar plantillas
  readonly puedeGestionarPlantillas = computed(() =>
    this.canManage() ||
    (this.isTecnico() && this._permisos().includes('editar_plantillas'))
  );

  tienePermiso(permiso: string): boolean {
    return this._permisos().includes(permiso);
  }

  private _refreshObs: Observable<any> | null = null;

  constructor(
    private http: HttpClient,
    private storage: StorageService,
    private router: Router,
    private offline: OfflineService,
  ) {}

  private recordarParaOffline() {
    const u = this._user();
    if (u) this.offline.recordarUsuario(u, this._permisos());
  }

  /** Sin conexión con el servidor: entra con el último usuario que inició sesión en este dispositivo. */
  restaurarSesionOffline(): boolean {
    const guardado = this.offline.usuarioOffline();
    if (!guardado) return false;
    this._user.set(guardado.user);
    this._permisos.set(guardado.permisos || []);
    return true;
  }

  checkSetupNeeded(): Observable<boolean> {
    return this.http.get<ApiResponse<{ needsSetup: boolean }>>(`${this.authUrl}/setup-needed`).pipe(
      map(r => r.data?.needsSetup ?? false)
    );
  }

  setup(data: { nombre: string; username: string; password: string }): Observable<{ data: LoginResponse }> {
    return this.http.post<{ success: boolean; data: LoginResponse }>(
      `${this.authUrl}/setup`, data, { withCredentials: true }
    ).pipe(
      tap(res => {
        this.storage.setToken(res.data.access_token);
        this._user.set(res.data.user);
        this.recordarParaOffline();
      })
    );
  }

  login(creds: LoginRequest): Observable<{ data: LoginResponse }> {
    return this.http.post<{ success: boolean; data: LoginResponse }>(
      `${this.authUrl}/login`, creds, { withCredentials: true }
    ).pipe(
      tap(res => {
        this.storage.setToken(res.data.access_token);
        this._user.set(res.data.user);
      }),
      switchMap(res => {
        if (res.data.user.rol === 'tecnico') {
          return this.http.get<ApiResponse<string[]>>(`${this.authUrl}/mis-permisos`, { withCredentials: true }).pipe(
            tap(r => this._permisos.set(r.data || [])),
            switchMap(() => of(res))
          );
        }
        return of(res);
      }),
      tap(() => this.recordarParaOffline()),
    );
  }

  refresh(): Observable<any> {
    if (!this._refreshObs) {
      this._refreshObs = this.http.post<{ success: boolean; data: { access_token: string } }>(
        `${this.authUrl}/refresh`, {}, { withCredentials: true }
      ).pipe(
        timeout(10000),
        tap(res => this.storage.setToken(res.data.access_token)),
        share(),
      );
      this._refreshObs.subscribe({
        complete: () => { this._refreshObs = null; },
        error:    () => { this._refreshObs = null; },
      });
    }
    return this._refreshObs;
  }

  loadMe(): Observable<any> {
    return this.http.get<ApiResponse<Omit<Usuario, 'activo' | 'creadoEn'>>>(
      `${this.authUrl}/me`, { withCredentials: true }
    ).pipe(
      tap(res => this._user.set(res.data ?? null)),
      switchMap(res => {
        if (res.data?.rol === 'tecnico') {
          return this.http.get<ApiResponse<string[]>>(`${this.authUrl}/mis-permisos`, { withCredentials: true }).pipe(
            tap(r => this._permisos.set(r.data || [])),
            switchMap(() => of(res))
          );
        }
        return of(res);
      }),
      tap(() => this.recordarParaOffline()),
    );
  }

  loadMisPermisos(): Observable<string[]> {
    return this.http.get<ApiResponse<string[]>>(`${this.authUrl}/mis-permisos`, { withCredentials: true }).pipe(
      tap(r => { this._permisos.set(r.data || []); this.recordarParaOffline(); }),
      map(r => r.data || [])
    );
  }

  logout(): void {
    this.http.post(`${this.authUrl}/logout`, {}, { withCredentials: true }).subscribe({ error: () => {} });
    this._clearSession();
  }

  changePassword(passwordActual: string, passwordNuevo: string): Observable<any> {
    return this.http.post(`${this.authUrl}/change-password`, {
      password_actual: passwordActual,
      password_nuevo:  passwordNuevo,
    }, { withCredentials: true });
  }

  _clearSession(): void {
    this.offline.olvidarUsuario();
    this.storage.clearToken();
    this._user.set(null);
    this._permisos.set([]);
    this.router.navigate(['/auth/login']);
  }
}
