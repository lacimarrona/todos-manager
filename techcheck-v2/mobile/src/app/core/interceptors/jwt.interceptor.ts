import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError, catchError, switchMap } from 'rxjs';
import { StorageService } from '../services/storage.service';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

function buildHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // El header ngrok solo se añade en desarrollo (cuando la URL del API contiene ngrok)
  if (environment.apiUrl.includes('ngrok')) {
    headers['ngrok-skip-browser-warning'] = '1';
  }
  return headers;
}

export const jwtInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const storage = inject(StorageService);
  const auth    = inject(AuthService);

  // Auth endpoints no llevan token pero sí el header de ngrok si aplica
  if (req.url.includes('/auth/login') || req.url.includes('/auth/refresh')) {
    return next(req.clone({ setHeaders: buildHeaders() }));
  }

  const token = storage.getAccessToken();
  const authedReq = req.clone({ setHeaders: buildHeaders(token ?? undefined) });

  return next(authedReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401) return throwError(() => err);

      // auth.refresh() ya deduplica múltiples llamadas simultáneas
      return auth.refresh().pipe(
        switchMap(() => {
          const newToken = storage.getAccessToken();
          return next(req.clone({ setHeaders: buildHeaders(newToken ?? undefined) }));
        }),
        catchError((refreshErr) => {
          auth.clearSession();
          return throwError(() => refreshErr);
        }),
      );
    }),
  );
};
