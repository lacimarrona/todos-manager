import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  const roles: string[] = route.data['roles'] ?? [];

  const decidir = () =>
    roles.length === 0 || roles.includes(auth.user()?.rol ?? '') ? true : router.createUrlTree(['/']);

  if (auth.isLogged()) return decidir();

  // Recarga o enlace directo: authGuard corre en paralelo y todavía está cargando la sesión.
  // Si authGuard falla, el router cancela la navegación sin esperar a este guard.
  return toObservable(auth.user).pipe(filter(u => !!u), take(1), map(decidir));
};
