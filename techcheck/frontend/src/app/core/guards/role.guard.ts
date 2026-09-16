import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  const roles: string[] = route.data['roles'] ?? [];

  if (roles.length === 0 || roles.includes(auth.user()?.rol ?? '')) return true;

  router.navigate(['/']);
  return false;
};
