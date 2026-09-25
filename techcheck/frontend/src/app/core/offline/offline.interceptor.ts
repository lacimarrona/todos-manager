import { HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, from, of, switchMap, tap, throwError, timeout } from 'rxjs';
import { OfflineService, SIN_OFFLINE, esErrorDeRed, nuevoId } from './offline.service';

const RE_REVISION_PUT = /\/api\/revisiones\/[^/?]+$/;

/**
 * Lecturas: primero la red; si no hay conexión, se responde con la última copia guardada.
 * Revisiones: si no hay conexión se guardan en la cola local y se suben al reconectar.
 * Fotos: sin conexión se conservan en el dispositivo y se suben junto con la revisión.
 * El resto de cambios necesita conexión.
 */
export const offlineInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SIN_OFFLINE) || !req.url.startsWith('/api/')) return next(req);
  const off = inject(OfflineService);

  if (req.method === 'GET') return lectura(req, next, off);
  if (req.url.startsWith('/api/auth/')) return next(req);

  const url = req.url.split('?')[0];
  if ((req.method === 'POST' && url === '/api/revisiones') || (req.method === 'PUT' && RE_REVISION_PUT.test(url))) {
    return revision(req, next, off);
  }
  if (req.method === 'POST' && url === '/api/archivos') return archivo(req, next, off);

  return next(req).pipe(catchError(err => {
    if (esErrorDeRed(err)) {
      off.marcarSinConexion();
      off.avisar('Esta acción necesita conexión con el servidor. Inténtalo cuando vuelvas a estar conectado.', 'error');
    }
    return throwError(() => err);
  }));
};

function plazo(off: OfflineService): number {
  return off.enLinea() ? 20000 : 6000;
}

function lectura(req: HttpRequest<unknown>, next: HttpHandlerFn, off: OfflineService): Observable<HttpEvent<unknown>> {
  if (req.responseType !== 'json' || req.url.includes('/exportar')) return next(req);
  const url = req.urlWithParams;
  return next(req).pipe(
    timeout({ first: plazo(off) }),
    tap(ev => {
      if (ev instanceof HttpResponse && ev.status === 200) {
        off.marcarEnLinea();
        off.guardarCache(url, ev.body);
      }
    }),
    catchError(err => {
      if (!esErrorDeRed(err)) return throwError(() => err);
      off.marcarSinConexion();
      return from(off.leerCache(url)).pipe(switchMap(body =>
        body !== undefined ? of(new HttpResponse({ status: 200, body, url })) : throwError(() => err)));
    }),
  );
}

function revision(req: HttpRequest<any>, next: HttpHandlerFn, off: OfflineService): Observable<HttpEvent<unknown>> {
  const method = req.method as 'POST' | 'PUT';
  const body = { ...req.body };
  if (method === 'POST') {
    body.id = body.id || nuevoId();
    body.creadoEn = body.creadoEn || new Date().toISOString();
  }

  const encolar = () => from(off.encolarRevision(method, req.url, body)).pipe(
    tap(() => {
      if (!off.enLinea()) off.avisar('Sin conexión: la revisión quedó guardada en este dispositivo y se subirá sola al reconectar.', 'info');
      off.verificarConexion();
    }),
    switchMap(rev => of(new HttpResponse({ status: 202, body: { success: true, data: rev }, url: req.url }))),
  );

  // Va a la cola si hay cambios anteriores sin subir (para respetar el orden)
  // o si trae fotos tomadas sin conexión (se suben como archivo antes de la revisión).
  if (off.hayPendientes() || JSON.stringify(body).includes('"pendienteSubir":true')) return encolar();

  return next(req.clone({ body })).pipe(
    timeout({ first: plazo(off) }),
    tap(ev => { if (ev instanceof HttpResponse) off.marcarEnLinea(); }),
    catchError(err => {
      if (!esErrorDeRed(err)) return throwError(() => err);
      off.marcarSinConexion();
      return encolar();
    }),
  );
}

function archivo(req: HttpRequest<any>, next: HttpHandlerFn, off: OfflineService): Observable<HttpEvent<unknown>> {
  const { nombre, tipo, data, proyectoId } = req.body || {};
  return next(req).pipe(
    timeout({ first: off.enLinea() ? 120000 : 6000 }),
    catchError(err => {
      if (!esErrorDeRed(err)) return throwError(() => err);
      off.marcarSinConexion();
      const local = { nombre, tipo, data, proyectoId, pendienteSubir: true };
      return of(new HttpResponse({ status: 201, body: { success: true, data: local }, url: req.url }));
    }),
  );
}
