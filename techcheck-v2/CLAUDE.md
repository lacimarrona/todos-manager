# CLAUDE.md — Contexto del Proyecto TechCheck v2.0

Este archivo le da contexto a Claude Code sobre el proyecto. Léelo completamente antes de hacer cualquier cambio.

---

## ¿Qué es este proyecto?

**TechCheck v2.0** es una plataforma de gestión de checklists de mantenimiento técnico con soporte web y móvil Android. Evoluciona de una app local (v1.0 con JSON) a una plataforma multi-workspace con MySQL, autenticación JWT y Docker.

---

## Stack tecnológico

### Backend
- Node.js + Express
- MySQL 8.x
- Sequelize (ORM + migraciones)
- JWT (autenticación)
- bcrypt (contraseñas)
- node-cron (tareas programadas)
- multer (subida de archivos)

### Frontend Web
- Angular 22
- Ionic 8 (componentes UI)
- Tailwind CSS
- Standalone components (sin NgModules)

### App Móvil
- Ionic 8 + Angular 20
- Capacitor (bridge nativo)
- Plugin de cámara de Capacitor

### DevOps
- Docker + Docker Compose
- MySQL en contenedor con volumen persistente
- Docker Hub: julianquintero/techcheck

---

## Roles del sistema

| Rol | Permisos |
|-----|---------|
| superadmin | Acceso total, crea workspaces y admins |
| admin | Administra su workspace, crea proyectos/usuarios/tareas, hace revisiones |
| usuario | Hace revisiones, sube evidencias |

Cada usuario pertenece a un workspace. El superadmin no pertenece a ninguno.

---

## Reglas de desarrollo — CRÍTICAS

1. **Un cambio a la vez** — nunca modificar múltiples archivos sin confirmar que el anterior funciona
2. **Base de datos solo por migraciones** — nunca modificar tablas directamente
3. **Nunca editar migraciones ya ejecutadas** — crear una nueva migración
4. **Frontend: separar lógica de template** — lógica en `.ts`, UI en `.html`, nunca `template:` inline
5. **No tocar lo que funciona** — si algo ya funciona, no modificarlo a menos que sea estrictamente necesario
6. **Commits atómicos** — un commit por funcionalidad completada
7. **Validar siempre en Docker** — probar el build antes de subir al NAS

---

## Estructura de directorios

```
techcheck-v2/
├── CLAUDE.md                    ← Este archivo
├── docker-compose.yml
├── .env.example
│
├── backend/
│   ├── src/
│   │   ├── index.js
│   │   ├── config/database.js
│   │   ├── middleware/auth.js
│   │   ├── models/
│   │   ├── routes/
│   │   ├── controllers/
│   │   └── jobs/tareas-cron.js
│   ├── migrations/
│   └── seeders/
│
├── frontend-web/
│   └── src/app/
│       ├── core/
│       │   ├── guards/
│       │   ├── interceptors/
│       │   ├── models/
│       │   └── services/
│       └── modules/
│           ├── auth/
│           ├── superadmin/
│           ├── workspace/
│           ├── proyectos/
│           ├── equipos/
│           ├── revisiones/
│           └── plantillas/
│
└── mobile/
    ├── capacitor.config.ts
    ├── android/
    └── src/
```

---

## Base de datos — tablas principales

```
workspaces          → id, nombre, descripcion, activo
usuarios            → id, workspace_id, nombre, email, password_hash, rol, activo
refresh_tokens      → id, usuario_id, token_hash, expires_at
proyectos           → id, workspace_id, nombre, descripcion, creado_por
equipos             → id, proyecto_id, nombre, plantilla_id, tecnico_asignado_id, tiempo_limite, archivado
items_equipo        → id, equipo_id, label, observacion_guia, orden
archivos_guia       → id, item_id, url, tipo
revisiones          → id, equipo_id, tecnico_id, estado, estado_calidad, observacion_general
items_revision      → id, revision_id, item_id, label, checked, nota
archivos_revision   → id, item_rev_id, url, tipo
archivos_obs_general→ id, revision_id, url, tipo
plantillas          → id, workspace_id, nombre, descripcion
items_plantilla     → id, plantilla_id, label, observacion_guia, orden
tareas_programadas  → id, equipo_id, hora, dias_semana, activa
tecnicos            → id, workspace_id, nombre, especialidad, contacto (catálogo de técnicos externos sin cuenta)
```

> **Nota sobre la tabla `tecnicos`:** Es un catálogo de técnicos externos (sin cuenta en el sistema).
> Los técnicos internos que ejecutan revisiones son usuarios con `rol = 'usuario'`.
> El campo `equipos.tecnico_asignado_id` referencia `usuarios`, no `tecnicos`.
> La tabla `tecnicos` está disponible para asociaciones futuras (asignación de externos, reportes a terceros).

---

## Autenticación

- JWT con access token (8h) y refresh token (7d)
- Header: `Authorization: Bearer {token}`
- Middleware `auth.js` valida token y agrega `req.user`
- La verificación de workspace está embebida en cada controlador via la función helper `wsId(req)` y queries con filtro por `workspace_id`

---

## Endpoints principales

```
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/change-password  (requiere auth)

GET/POST       /api/admin/workspaces
POST           /api/admin/workspaces/:id/admins

GET/POST/PUT/DELETE  /api/proyectos
GET                  /api/proyectos/:id/equipos?estado=pendiente|en_proceso|terminado
GET                  /api/proyectos/:id/exportar-csv

GET/POST/PUT/DELETE  /api/equipos
POST                 /api/equipos/:id/clonar

GET/POST/PUT/DELETE  /api/revisiones

GET/POST/PUT/DELETE  /api/plantillas
POST                 /api/plantillas/importar-excel

GET/POST/PUT/DELETE  /api/tareas-programadas
```

---

## Funcionalidades implementadas (estado actual)

Todas las funcionalidades originales están completas. Ver `README.md` para el detalle.

### Pendiente / próximos pasos
- Módulo de reportes/dashboard (estadísticas por workspace)
- Paginación en endpoints de alta carga (`/revisiones`, `/proyectos/:id/equipos`)

### Clonar equipo
- Duplica el equipo con todos sus ítems
- Se puede clonar en el mismo proyecto u otro del mismo workspace

### Exportar CSV
- Por proyecto, incluye: equipo, ítems, estado, técnico, fecha, observaciones
- Disponible para admin y superadmin

### Cámara en móvil
- Usando `@capacitor/camera`
- Al hacer revisión, el usuario puede tomar foto directamente
- Se sube como archivo al backend

---

## Variables de entorno requeridas

```env
DB_HOST=mysql
DB_PORT=3306
DB_NAME=techcheck
DB_USER=techcheck_user
DB_PASSWORD=
DB_ROOT_PASSWORD=
JWT_SECRET=
JWT_EXPIRES_IN=8h
JWT_REFRESH_EXPIRES_IN=7d
PORT=4000
NODE_ENV=development
APP_NAME=TechCheck
APP_VERSION=2.0.0
SUPERADMIN_EMAIL=admin@techcheck.com
SUPERADMIN_PASSWORD=
```

---

## Comandos útiles

```bash
# Levantar todo en Docker
docker compose up -d

# Ejecutar migraciones
docker exec techcheck-backend npx sequelize-cli db:migrate

# Ejecutar seeders
docker exec techcheck-backend npx sequelize-cli db:seed:all

# Ver logs del backend
docker compose logs -f backend

# Crear nueva migración
npx sequelize-cli migration:generate --name nombre-de-la-migracion

# Revertir última migración
npx sequelize-cli db:migrate:undo
```

---

## Fase actual de desarrollo

Ver `techcheck_v2_planificacion.md` para el orden completo de desarrollo.

**Próximo paso:** Fase 1 — Setup del proyecto con Express + Sequelize + MySQL en Docker.

---

## Contexto del desarrollador

- Desarrollador: Julian (Automate Col S.A.S., Rionegro, Antioquia, Colombia)
- Editor: VS Code con Claude Code
- OS de desarrollo: Windows 11
- Despliegue objetivo: Synology NAS (servidor local empresa)
- Experiencia: Full-stack, Angular, Node.js, Docker, PostgreSQL/MySQL
- Preferencias:
  - Un cambio a la vez
  - Separar siempre lógica (.ts) de template (.html)
  - Tailwind para estilos
  - Nunca modificar código que ya funciona
  - Preguntar antes de hacer cambios grandes
