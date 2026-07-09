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

  // Has a stored token → try to hydrate the user
  if (storage.getAccessToken()) {
    return auth.loadMe().pipe(
      switchMap(() => of(true)),
      catchError(() => {
        router.navigate(['/auth/login']);
        return of(false);
      }),
    );
  }

  router.navigate(['/auth/login']);
  return false;
};
