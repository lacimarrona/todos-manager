import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { StorageService } from '../services/storage.service';
import { switchMap, of, catchError } from 'rxjs';

export const authGuard: CanActivateFn = () => {
  const auth    = inject(AuthService);
  const storage = inject(StorageService);
  const router  = inject(Router);

  // Already has user in memory
  if (auth.isLogged()) return true;

  // Has access token in memory → load user from /me
  if (storage.getAccessToken()) {
    return auth.loadMe().pipe(
      switchMap(() => of(true)),
      catchError(() => {
        router.navigate(['/auth/login']);
        return of(false);
      }),
    );
  }

  // No access token in memory (page reload) — try to renew via httpOnly cookie
  return auth.refresh().pipe(
    switchMap(() => auth.loadMe()),
    switchMap(() => of(true)),
    catchError(() => {
      router.navigate(['/auth/login']);
      return of(false);
    }),
  );
};
