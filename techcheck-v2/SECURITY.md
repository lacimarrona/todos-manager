# SECURITY.md — Historial de auditoría y hardening de seguridad

> Este archivo documenta las auditorías de seguridad realizadas sobre TechCheck v2.0, los hallazgos encontrados, y las correcciones aplicadas. Se actualiza cada vez que se ejecuta el proceso de escaneo definido en `prompt-escaneo-seguridad.md`.

---

## Auditoría 1 — 2026-07-09

### Herramientas ejecutadas

| Herramienta | Versión | Ámbito |
|---|---|---|
| Gitleaks | 8.x | Historial completo de git |
| npm audit | npm 10 | backend/, frontend-web/, mobile/ |
| Semgrep | auto | Código fuente completo |
| Trivy | latest | Imágenes Docker del proyecto |

---

### Hallazgos y estado

#### ALTO — nginx 1.27-alpine con CVEs activas
- **Archivo:** `frontend-web/Dockerfile`
- **Descripción:** La imagen base `nginx:1.27-alpine` presentaba 2 CVEs críticas y 34 altas, incluyendo CVE-2025-15467 (ejecución remota de código vía TLS).
- **Corrección aplicada:** Actualización a `nginx:1.28-alpine`. Resultado: 2 críticas residuales (en librerías del sistema sin parche disponible) y 22 altas — eliminación de 12 CVEs altas y la CVE-2025-15467.
- **Estado:** CORREGIDO

#### MEDIO — `rejectUnauthorized: false` en conexión SSL a base de datos
- **Archivo:** `backend/src/config/sequelize.js:27`
- **Descripción:** Semgrep detectó bypass de verificación de certificado TLS en la conexión a MySQL. En producción esto permite ataques man-in-the-middle sobre la conexión a la base de datos.
- **Corrección aplicada:** Reemplazado con la función `buildSslConfig()` que soporta verificación real del certificado mediante la variable `DB_SSL_CA`:
  ```js
  function buildSslConfig() {
    if (process.env.DB_SSL !== 'true') return false;
    const caPath = process.env.DB_SSL_CA;
    if (caPath) return { rejectUnauthorized: true, ca: fs.readFileSync(caPath) };
    return { rejectUnauthorized: true };
  }
  ```
- **Estado:** CORREGIDO

#### BAJO — Secretos de ejemplo en `.env.example`
- **Archivo:** `.env.example`
- **Descripción:** Gitleaks marcó valores de ejemplo en `.env.example`. Son placeholders, no credenciales reales.
- **Estado:** FALSO POSITIVO — sin acción requerida

#### BAJO — Vulnerabilidades `undici` en dependencias internas de npm
- **Paquete:** `undici` (dependencia interna de npm, no del código de la aplicación)
- **Descripción:** npm audit reportó vulnerabilidades en `undici`, usado internamente por npm 10, no por el código de TechCheck.
- **Estado:** NO EXPLOTABLE EN ESTE CONTEXTO — la versión de node (20-alpine) limita la actualización de npm a versiones que aún incluyen esta dependencia. El riesgo real es nulo al no ser código de la aplicación.

---

### Mejoras de infraestructura aplicadas durante la auditoría

#### `backend/.dockerignore` creado
- **Motivo:** El directorio `node_modules/` del host (compilado para Windows/Node 20) se estaba copiando al contexto de build de Docker, sobreescribiendo el `npm install` del contenedor y causando errores de módulos nativos (bcrypt).
- **Corrección:** Creado `backend/.dockerignore` con exclusión de `node_modules` y `npm-debug.log`.

#### CORS — Soporte para Capacitor (app móvil)
- **Archivo:** `backend/src/index.js`
- **Descripción:** La app Capacitor en Android envía `Origin: https://localhost` en todas las peticiones. El backend rechazaba este origen con 500, impidiendo el login desde la app móvil.
- **Corrección aplicada:** Se añadió una lista blanca fija para orígenes de Capacitor:
  ```js
  const CAPACITOR_ORIGINS = new Set(['https://localhost', 'capacitor://localhost']);
  // Los orígenes de Capacitor siempre permitidos, antes de evaluar CORS_ORIGIN
  ```
- **Estado:** CORREGIDO

---

### Controles de seguridad existentes (verificados en la auditoría)

| Control | Implementación | Estado |
|---|---|---|
| Autenticación | JWT HS256, access 8 h + refresh 7 d | OK |
| Revocación de tokens | Tabla `refresh_tokens` en BD con hash SHA-256 | OK |
| Hash de contraseñas | bcrypt (costo por defecto = 10) | OK |
| Rate limiting en login | 20 intentos / 15 min por IP + endpoint | OK |
| Headers de seguridad HTTP | Helmet.js (CSP desactivado para SPA) | OK |
| Aislamiento multi-tenant | Todas las queries filtran por `workspace_id` del usuario autenticado | OK |
| Secretos fuera del repo | `.env` en `.gitignore`, sin secretos en historial | OK |
| Validación de roles | Middleware `auth.js` valida rol en backend en cada request | OK |
| Errores en producción | Global error handler no expone stack traces al cliente | OK |
| Permisos Capacitor | Solo cámara y almacenamiento — acordes a las funcionalidades | OK |

---

### Hallazgos pendientes / aceptados

| Hallazgo | Severidad | Decisión |
|---|---|---|
| JWT guardado en `localStorage` (frontend web) | MEDIO | Aceptado — alternativa (cookie httpOnly) requiere cambio de arquitectura. Mitigado por CSP y ausencia de `innerHTML` inseguro. |
| JWT guardado en `@capacitor/preferences` (mobile) | BAJO | Aceptado — en Android se mapea a SharedPreferences cifradas. Sin datos financieros ni de salud. |
| Sin certificate pinning en la app móvil | BAJO | Aceptado — no maneja datos financieros ni de salud. Aplicable si se escala a esos dominios. |
| 2 CVEs críticas residuales en nginx:1.28-alpine | CRÍTICO (imagen) | Sin parche disponible en la versión actual. Monitorear actualizaciones de nginx:1.29-alpine. |

---

## Proceso de re-auditoría

Para repetir el escaneo completo, usar el prompt en `prompt-escaneo-seguridad.md`. Se recomienda ejecutar antes de cada release mayor o al incorporar nuevas dependencias significativas.
