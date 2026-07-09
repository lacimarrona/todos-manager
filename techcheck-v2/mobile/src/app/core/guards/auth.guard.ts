import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Network } from '@capacitor/network';
import { AuthService } from '../services/auth.service';
import { StorageService } from '../services/storage.service';
import { switchMap, of, catchError, from } from 'rxjs';

export const authGuard: CanActivateFn = () => {
  const auth    = inject(AuthService);
  const storage = inject(StorageService);
  const router  = inject(Router);

  // Ya tiene usuario en memoria → acceso directo
  if (auth.isLogged()) return true;

  // Sin token guardado → login
  if (!storage.getAccessToken()) {
    router.navigate(['/auth/login']);
    return false;
  }

  // Tiene token: intentar cargar usuario
  return from(Network.getStatus()).pipe(
    switchMap(status => {
      if (!status.connected) {
        // Sin internet: cargar usuario desde caché local
        return from(auth.loadMeFromCache()).pipe(
          switchMap(user => {
            if (user) return of(true);
            router.navigate(['/auth/login']);
            return of(false);
          }),
        );
      }

      // Con internet: cargar desde la API
      return auth.loadMe().pipe(
        switchMap(() => of(true)),
        catchError(() => {
          router.navigate(['/auth/login']);
          return of(false);
        }),
      );
    }),
  );
};
