# TechCheck v2.0

Plataforma de gestión de checklists de mantenimiento técnico con soporte **web** y **móvil Android**. Arquitectura multi-workspace con autenticación JWT, base de datos MySQL y despliegue en Docker.

---

## Stack tecnológico

| Capa | Tecnologías |
|---|---|
| Backend | Node.js 20 · Express · Sequelize · MySQL 8 · bcrypt · JWT |
| Frontend web | Angular 22 · Ionic 8 · SCSS custom · Standalone components |
| App móvil | Ionic 8 · Angular 22 · Capacitor 7 · Android |
| DevOps | Docker · Docker Compose · nginx 1.28-alpine |

---

## Requisitos previos

- Docker Desktop
- Node.js 20+ (para desarrollo local y build de la APK)
- Android Studio (JBR incluido — para compilar la APK)
- Android SDK Platform Tools (para instalar vía ADB)

---

## Levantar el entorno

```bash
# 1. Copiar variables de entorno
cp .env.example .env
# Editar .env con las credenciales reales

# 2. Levantar backend + base de datos
cd techcheck-v2
docker compose up -d

# 3. Ejecutar migraciones (primera vez)
docker exec techcheck-backend npx sequelize-cli db:migrate
docker exec techcheck-backend npx sequelize-cli db:seed:all

# 4. Compilar y levantar el frontend web (manual — no está en compose)
cd frontend-web
docker build -t techcheck-v2-frontend .
docker run -d --name techcheck-frontend \
  --network techcheck-v2_default \
  --restart unless-stopped \
  -p 8080:80 \
  techcheck-v2-frontend
```

La app web queda disponible en `http://localhost:8080`.

---

## Variables de entorno requeridas

| Variable | Descripción |
|---|---|
| `DB_HOST` | Host de MySQL (en Docker: `mysql`) |
| `DB_PORT` | Puerto MySQL (3306) |
| `DB_NAME` | Nombre de la base de datos |
| `DB_USER` | Usuario de MySQL |
| `DB_PASSWORD` | Contraseña de MySQL |
| `DB_ROOT_PASSWORD` | Contraseña root de MySQL |
| `JWT_SECRET` | Clave secreta para firmar tokens JWT |
| `JWT_EXPIRES_IN` | Duración del access token (ej. `8h`) |
| `JWT_REFRESH_EXPIRES_IN` | Duración del refresh token (ej. `7d`) |
| `PORT` | Puerto del backend (4000) |
| `NODE_ENV` | `development` o `production` |
| `CORS_ORIGIN` | Orígenes web permitidos, separados por coma |
| `SUPERADMIN_EMAIL` | Email del superadmin inicial |
| `SUPERADMIN_PASSWORD` | Contraseña del superadmin inicial |
| `DB_SSL` | `true` para habilitar SSL con la BD |
| `DB_SSL_CA` | Ruta al archivo CA si se usa SSL verificado |

---

## Compilar y distribuir la APK

```bash
cd mobile

# 1. Build del proyecto Angular/Ionic
npm run build

# 2. Sincronizar con Capacitor
npx cap sync android

# 3. Compilar la APK (requiere JAVA_HOME apuntando al JBR de Android Studio)
cd android
./gradlew assembleDebug

# APK generada en: android/app/build/outputs/apk/debug/app-debug.apk

# 4. Instalar en dispositivo conectado via ADB
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Para conectar la app móvil con el backend en desarrollo, se recomienda usar **ngrok**:

```bash
ngrok http 4000
# Actualizar la URL base en mobile/src/environments/environment.ts
```

---

## Roles del sistema

| Rol | Permisos |
|---|---|
| `superadmin` | Acceso total — crea workspaces y administradores |
| `admin` | Administra su workspace: proyectos, equipos, usuarios, revisiones |
| `usuario` | Ejecuta revisiones y sube evidencias fotográficas |

Cada usuario pertenece a exactamente un workspace. El superadmin no pertenece a ninguno.

---

## Funcionalidades implementadas

### Backend
- Autenticación JWT con access token (8 h) y refresh token (7 d)
- Revocación de refresh tokens en base de datos
- Rate limiting en `/api/auth/login` y `/api/auth/refresh` (20 intentos / 15 min)
- CRUD completo de workspaces, usuarios, proyectos, equipos, plantillas, revisiones
- Importación de equipos desde Excel (`POST /api/plantillas/importar-excel`)
- Exportación de reportes por proyecto en CSV (`GET /api/proyectos/:id/exportar-csv`)
- Clonar equipos con todos sus ítems (`POST /api/equipos/:id/clonar`)
- Tareas programadas con node-cron (revisiones automáticas por hora y días de semana)
- Subida de archivos con multer (evidencias fotográficas)
- Deduplicación de archivos por hash
- Estado "archivado" para equipos e ítems
- Observaciones y guías en ítems de plantilla

### Frontend web
- Módulo superadmin: gestión de workspaces y administradores
- Módulo workspace: proyectos, equipos, usuarios, revisiones, plantillas, reportes
- Módulo técnico: lista de equipos asignados con estado
- Toggle de contraseña con `IonInputPasswordToggle` (área de toque estándar 44×44 px)
- Confirmación al cerrar modales con cambios sin guardar
- Exportar CSV desde la vista de proyectos

### App móvil (Android)
- Mismas funcionalidades que el frontend web
- Login con soporte offline (hash local con `@capacitor/preferences`)
- Captura de evidencias fotográficas con `@capacitor/camera`
- Toggle de contraseña con `IonInputPasswordToggle` en todos los modales
- Detección de conectividad con `@capacitor/network`

---

## Tests

### Backend (Vitest + Supertest)

Corre contra una base de datos de test separada (`techcheck_test`), nunca contra la de desarrollo.

```bash
# 1. Una sola vez: crear la BD de test si el volumen de MySQL ya existía antes
#    de agregar backend/docker/init-test-db.sql (si el volumen es nuevo, se crea sola).
#    Reemplazar <DB_ROOT_PASSWORD> por el valor real de tu .env.
docker compose exec mysql mysql -uroot -p<DB_ROOT_PASSWORD> -e \
  "CREATE DATABASE IF NOT EXISTS techcheck_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL PRIVILEGES ON techcheck_test.* TO 'techcheck_user'@'%'; FLUSH PRIVILEGES;"

# 2. Copiar la config de test y ajustar si hace falta
cd backend
cp .env.test.example .env.test

# 3. Migrar la BD de test (solo la primera vez o tras agregar migraciones nuevas)
docker compose exec backend npm run db:migrate:test

# 4. Correr los tests
docker compose exec backend npm test
```

### Frontend web y mobile (Vitest, vía Angular)

```bash
cd frontend-web   # o cd mobile
npm test
```

> Nota: los componentes que usan `@ionic/angular` (ej. `ion-app`) no se pueden testear
> hoy con el test runner nativo de Angular — es un bug externo sin resolver
> ([ionic-team/ionic-framework#30982](https://github.com/ionic-team/ionic-framework/issues/30982)).
> Los tests actuales se enfocan en servicios, guards y lógica pura.

### CI

Los tres suites corren automáticamente en GitHub Actions en cada push/PR que toque `techcheck-v2/**` (`.github/workflows/techcheck-v2-ci.yml` en la raíz del repo).

---

## Comandos útiles

```bash
# Ver logs del backend
docker compose logs -f backend

# Crear una nueva migración
docker exec techcheck-backend npx sequelize-cli migration:generate --name nombre

# Revertir última migración
docker exec techcheck-backend npx sequelize-cli db:migrate:undo

# Reconstruir el frontend web y reiniciarlo
cd frontend-web
docker build -t techcheck-v2-frontend .
docker rm -f techcheck-frontend
docker run -d --name techcheck-frontend \
  --network techcheck-v2_default \
  --restart unless-stopped \
  -p 8080:80 \
  techcheck-v2-frontend
```

---

## Documentación adicional

- [CLAUDE.md](CLAUDE.md) — contexto del proyecto para Claude Code
- [SECURITY.md](SECURITY.md) — historial de auditoría y hardening de seguridad
- [prompt-escaneo-seguridad.md](prompt-escaneo-seguridad.md) — prompt para re-ejecutar el escaneo automático
- [prompt-auditoria-seguridad.md](prompt-auditoria-seguridad.md) — prompt para auditoría manual profunda
