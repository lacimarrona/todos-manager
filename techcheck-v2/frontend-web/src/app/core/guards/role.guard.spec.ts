import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router } from '@angular/router';
import { roleGuard } from './role.guard';
import { AuthService } from '../services/auth.service';

function routeWithRoles(roles: string[]): ActivatedRouteSnapshot {
  return { data: { roles } } as unknown as ActivatedRouteSnapshot;
}

describe('roleGuard', () => {
  let navigate: ReturnType<typeof vi.fn>;

  function setup(role: string | null) {
    navigate = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { role: () => role } },
        { provide: Router, useValue: { navigate } },
      ],
    });
  }

  it('permite el acceso si el rol del usuario está en route.data.roles', () => {
    setup('admin');
    const result = TestBed.runInInjectionContext(() =>
      roleGuard(routeWithRoles(['admin', 'superadmin']), {} as any)
    );
    expect(result).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('redirige a /unauthorized si el rol no está permitido', () => {
    setup('usuario');
    const result = TestBed.runInInjectionContext(() =>
      roleGuard(routeWithRoles(['admin', 'superadmin']), {} as any)
    );
    expect(result).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/unauthorized']);
  });

  it('redirige a /unauthorized si no hay usuario logueado (role null)', () => {
    setup(null);
    const result = TestBed.runInInjectionContext(() =>
      roleGuard(routeWithRoles(['admin']), {} as any)
    );
    expect(result).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/unauthorized']);
  });

  it('redirige a /unauthorized si la ruta no define roles permitidos', () => {
    setup('admin');
    const result = TestBed.runInInjectionContext(() =>
      roleGuard(routeWithRoles([]), {} as any)
    );
    expect(result).toBe(false);
  });
});
