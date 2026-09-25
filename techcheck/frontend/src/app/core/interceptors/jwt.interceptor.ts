import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError, switchMap, catchError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { StorageService } from '../services/storage.service';
import { esErrorDeRed } from '../offline/offline.service';

export const jwtInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const auth    = inject(AuthService);
  const storage = inject(StorageService);

  // Rutas de auth no llevan token en la cabecera
  if (req.url.includes('/auth/login') || req.url.includes('/auth/refresh')) {
    return next(req);
  }

  const token = storage.getToken();
  const authed = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authed).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) {
        return auth.refresh().pipe(
          switchMap(() => {
            const newToken = storage.getToken();
            const retried = req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } });
            return next(retried);
          }),
          catchError(refreshErr => {
            if (!esErrorDeRed(refreshErr)) auth._clearSession();
            return throwError(() => refreshErr);
          })
        );
      }
      return throwError(() => err);
    })
  );
};
