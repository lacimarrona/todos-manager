import { inject } from '@angular/core';
import { CanActivateFn, ActivatedRouteSnapshot, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/user.model';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  const allowedRoles: UserRole[] = route.data['roles'] ?? [];
  const userRole = auth.role();

  if (!userRole || !allowedRoles.includes(userRole as UserRole)) {
    router.navigate(['/unauthorized']);
    return false;
  }

  return true;
};
