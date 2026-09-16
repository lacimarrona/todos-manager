import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { StorageService } from '../services/storage.service';

export const authGuard: CanActivateFn = () => {
  const auth    = inject(AuthService);
  const storage = inject(StorageService);
  const router  = inject(Router);

  // Ya está logueado en memoria
  if (auth.isLogged()) return true;

  // Hay token en sessionStorage (recarga de página)
  if (storage.getToken()) {
    return auth.loadMe().pipe(
      map(() => true),
      catchError(() => {
        // Token expirado → intentar refresh
        return auth.refresh().pipe(
          switchMap(() => auth.loadMe()),
          map(() => true),
          catchError(() => { router.navigate(['/auth/login']); return of(false); })
        );
      })
    );
  }

  // Sin token → intentar refresh via cookie httpOnly
  return auth.refresh().pipe(
    switchMap(() => auth.loadMe()),
    map(() => true),
    catchError(() => { router.navigate(['/auth/login']); return of(false); })
  );
};
