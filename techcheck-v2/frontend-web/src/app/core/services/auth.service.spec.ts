import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './auth.service';
import { StorageService } from './storage.service';

// Codifica un JWT falso (header.payload.firma) en base64url, suficiente para
// decodeToken()/isTokenExpired(), que solo leen el payload sin validar la firma.
function fakeJwt(payload: object): string {
  const b64 = (obj: object) => btoa(JSON.stringify(obj)).replace(/=+$/, '');
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma-no-verificada`;
}

describe('AuthService', () => {
  let service: AuthService;
  let storage: StorageService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    service = TestBed.inject(AuthService);
    storage = TestBed.inject(StorageService);
    httpMock = TestBed.inject(HttpTestingController);
    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  describe('decodeToken / isTokenExpired', () => {
    it('devuelve null si no hay access token guardado', () => {
      expect(service.decodeToken()).toBeNull();
    });

    it('decodifica el payload de un token guardado', () => {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      storage.setTokens(fakeJwt({ sub: 1, email: 'a@test.com', rol: 'admin', workspace_id: 1, exp }), 'refresh');

      const payload = service.decodeToken();
      expect(payload).toEqual({ sub: 1, email: 'a@test.com', rol: 'admin', workspace_id: 1, exp });
    });

    it('isTokenExpired es true si no hay token', () => {
      expect(service.isTokenExpired()).toBe(true);
    });

    it('isTokenExpired es true si el token ya venció', () => {
      const exp = Math.floor(Date.now() / 1000) - 10;
      storage.setTokens(fakeJwt({ sub: 1, exp }), 'refresh');
      expect(service.isTokenExpired()).toBe(true);
    });

    it('isTokenExpired es false si el token sigue vigente', () => {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      storage.setTokens(fakeJwt({ sub: 1, exp }), 'refresh');
      expect(service.isTokenExpired()).toBe(false);
    });
  });

  describe('refresh()', () => {
    it('no hace ninguna request si no hay refresh token guardado', () => {
      service.refresh().subscribe();
      httpMock.expectNone('http://localhost:4000/api/auth/refresh');
    });

    it('deduplica llamadas concurrentes: dos refresh() disparan una sola request HTTP', () => {
      storage.setTokens('access-viejo', 'refresh-token-1');

      let firstResult: unknown;
      let secondResult: unknown;
      service.refresh().subscribe(res => (firstResult = res));
      service.refresh().subscribe(res => (secondResult = res));

      const reqs = httpMock.match('http://localhost:4000/api/auth/refresh');
      expect(reqs.length).toBe(1);

      reqs[0].flush({ access_token: 'access-nuevo', refresh_token: 'refresh-nuevo' });

      expect(firstResult).toEqual({ access_token: 'access-nuevo', refresh_token: 'refresh-nuevo' });
      expect(secondResult).toEqual({ access_token: 'access-nuevo', refresh_token: 'refresh-nuevo' });
    });

    it('permite un nuevo refresh una vez que el anterior terminó', () => {
      storage.setTokens('access-viejo', 'refresh-token-1');

      service.refresh().subscribe();
      httpMock.match('http://localhost:4000/api/auth/refresh')[0]
        .flush({ access_token: 'a1', refresh_token: 'r1' });

      service.refresh().subscribe();
      const segundaTanda = httpMock.match('http://localhost:4000/api/auth/refresh');
      expect(segundaTanda.length).toBe(1);
      segundaTanda[0].flush({ access_token: 'a2', refresh_token: 'r2' });
    });
  });
});
