import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError, catchError, switchMap } from 'rxjs';
import { StorageService } from '../services/storage.service';
import { AuthService } from '../services/auth.service';

export const jwtInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const storage = inject(StorageService);
  const auth    = inject(AuthService);

  // Auth endpoints no llevan token
  if (req.url.includes('/auth/login') || req.url.includes('/auth/refresh')) {
    return next(req);
  }

  const token = storage.getAccessToken();
  const authedReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authedReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401) return throwError(() => err);

      // auth.refresh() deduplica múltiples 401 simultáneos con share()
      return auth.refresh().pipe(
        switchMap(() => {
          const newToken = storage.getAccessToken();
          const retryReq = newToken
            ? req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } })
            : req;
          return next(retryReq);
        }),
        catchError((refreshErr) => {
          auth.clearSession();
          return throwError(() => refreshErr);
        }),
      );
    }),
  );
};
