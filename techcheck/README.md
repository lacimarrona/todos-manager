# TechCheck — Documentación Técnica

**Versión:** 1.5.0  
**Fecha:** Septiembre 2026

---

## Tabla de Contenidos

1. [Descripción General](#1-descripción-general)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Estructura de Directorios](#3-estructura-de-directorios)
4. [Base de Datos — SQLite](#4-base-de-datos--sqlite)
5. [Backend — Node.js / Express](#5-backend--nodejs--express)
   - 5.1 [Middleware](#51-middleware)
   - 5.2 [Rutas API](#52-rutas-api)
6. [Frontend — Angular 19](#6-frontend--angular-19)
   - 6.1 [Módulos y Componentes](#61-módulos-y-componentes)
   - 6.2 [Modelos de Datos (TypeScript)](#62-modelos-de-datos-typescript)
7. [Sistema de Roles y Permisos](#7-sistema-de-roles-y-permisos)
8. [Autenticación](#8-autenticación)
9. [Funcionalidades del Sistema](#9-funcionalidades-del-sistema)
10. [Instalación y Despliegue](#10-instalación-y-despliegue)
11. [Docker](#11-docker)
12. [Variables de Entorno](#12-variables-de-entorno)

---

## 1. Descripción General

**TechCheck** es una aplicación web de gestión de checklists de mantenimiento técnico orientada a equipos de soporte de TI. Permite organizar proyectos, asignar técnicos, registrar revisiones con evidencia fotográfica y controlar el acceso por roles.

### Tecnologías

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Frontend | Angular | 19 |
| Estilos | Tailwind CSS | 3.x |
| Backend | Node.js + Express | 4.x |
| Base de datos | SQLite (`node:sqlite` nativo) | Node ≥ 22 |
| Autenticación | JWT + bcrypt | — |
| Contenedor | Docker | — |

---

## 2. Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────┐
│                   NAVEGADOR WEB                      │
│                                                      │
│   Angular 19 (SPA)                                   │
│   ├── Auth (login)                                   │
│   ├── Dashboard                                      │
│   ├── Proyectos / Equipos                            │
│   ├── Revisiones / Historial                         │
│   ├── Plantillas                                     │
│   ├── Usuarios                                       │
│   ├── Tareas programadas                             │
│   ├── Catálogos                                      │
│   └── Exportar / Importar                            │
└────────────────────┬────────────────────────────────┘
                     │ HTTP / REST API  (Authorization: Bearer <token>)
┌────────────────────▼────────────────────────────────┐
│              BACKEND — Express.js                    │
│                                                      │
│   Middleware: auth · roles · proyectoAccess          │
│                                                      │
│   /api/auth        /api/usuarios    /api/proyectos   │
│   /api/equipos     /api/revisiones  /api/plantillas  │
│   /api/tareas      /api/catalogos   /api/dashboard   │
│   /api/archivos    /api/exportar                     │
│                                                      │
│   db/dataAccess.js  (abstracción de la BD)           │
└────────────────────┬────────────────────────────────┘
                     │ node:sqlite
┌────────────────────▼────────────────────────────────┐
│              SQLite — techcheck.db                   │
│                                                      │
│   proyectos · equipos · revisiones · plantillas      │
│   usuarios · refresh_tokens · proyecto_permisos      │
│   tecnico_supervisores · tareas · catalogos          │
└─────────────────────────────────────────────────────┘
```

---

## 3. Estructura de Directorios

```
techcheck/
├── Dockerfile
├── docker-compose.yml
├── backend/
│   ├── index.js                   ← Servidor Express
│   ├── package.json
│   ├── data/
│   │   ├── techcheck.db           ← Base de datos SQLite
│   │   └── archivos/              ← Archivos adjuntos (por hash SHA-256)
│   ├── db/
│   │   ├── sqlite.js              ← Inicialización y migraciones de la BD
│   │   ├── dataAccess.js          ← Capa de acceso a datos
│   │   └── migrate.js             ← Script de migración JSON → SQLite
│   ├── middleware/
│   │   ├── auth.js                ← Validación de JWT
│   │   ├── roles.js               ← Control de acceso por rol
│   │   └── proyectoAccess.js      ← Acceso a proyectos según rol
│   └── routes/
│       ├── auth.js
│       ├── usuarios.js
│       ├── proyectos.js
│       ├── equipos.js
│       ├── revisiones.js
│       ├── plantillas.js
│       ├── tareas.js
│       ├── catalogos.js
│       ├── dashboard.js
│       ├── archivos.js
│       └── exportar.js
└── frontend/
    ├── angular.json
    ├── package.json
    ├── tailwind.config.js
    └── src/app/
        ├── core/
        │   ├── models/models.ts   ← Interfaces TypeScript
        │   ├── services/          ← Servicios HTTP
        │   └── guards/            ← Guardas de rutas
        └── modules/
            ├── auth/
            ├── dashboard/
            ├── equipos/
            ├── revisiones/
            ├── historial/
            ├── plantillas/
            ├── usuarios/
            ├── tareas/
            ├── catalogos/
            └── exportar/
```

---

## 4. Base de Datos — SQLite

La BD vive en `backend/data/techcheck.db` y se inicializa automáticamente al arrancar el servidor. Se usa el módulo nativo `node:sqlite` (disponible desde Node.js 22).

### Tablas principales

| Tabla | Descripción |
|-------|-------------|
| `proyectos` | Proyectos de mantenimiento |
| `equipos` | Dispositivos/activos dentro de un proyecto |
| `revisiones` | Registros de revisiones realizadas sobre un equipo |
| `plantillas` | Plantillas de checklist reutilizables |
| `usuarios` | Todos los usuarios (admin, project_admin, técnico) |
| `refresh_tokens` | Tokens de refresco para JWT (rotación automática) |
| `proyecto_permisos` | Nivel de acceso de un técnico a un proyecto |
| `tecnico_supervisores` | Relación técnico ↔ project_admin |
| `tareas_programadas` | Revisiones recurrentes (por día/hora) |
| `grupos_elementos` | Grupos de catálogos |
| `elementos_grupo` | Ítems de un catálogo |

### Tabla `proyecto_permisos`

Controla qué técnicos tienen acceso a qué proyectos y con qué nivel:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `proyecto_id` | TEXT | ID del proyecto |
| `tecnico_id` | TEXT | ID del técnico |
| `nivel` | TEXT | `ver` · `asignados` · `editar` |

**Niveles:**
- `ver` — puede ver todos los equipos del proyecto (solo lectura)
- `asignados` — solo ve los equipos que tiene asignados como `tecnicoAsignadoId`
- `editar` — tiene permisos equivalentes a un project_admin en ese proyecto

---

## 5. Backend — Node.js / Express

### 5.1 Middleware

#### `auth.js`
Valida el JWT enviado en el header `Authorization: Bearer <token>`. Añade `req.user = { sub, rol }` a la solicitud. Las rutas protegidas devuelven 401 si el token es inválido o ha expirado.

#### `roles.js`
Factory que recibe los roles permitidos y bloquea con 403 si el usuario no tiene el rol requerido:
```js
router.use(auth, roles('admin', 'project_admin'));
```

#### `proyectoAccess.js`
Middlewares especializados para el control de acceso a proyectos:
- `soloAdmin` — solo rol `admin`
- `adminOProjectAdmin` — `admin` o `project_admin`
- `verificarAccesoProyecto` — comprueba que el usuario tenga acceso al proyecto solicitado
- `inyectarProyectosVisibles` — añade `req.proyectosIds` con los IDs de proyectos que el usuario puede ver

### 5.2 Rutas API

#### Auth — `/api/auth`

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/login` | No | Inicia sesión con username/password. Devuelve access token y establece cookie de refresh token |
| `POST` | `/refresh` | Cookie | Rota el refresh token y devuelve nuevo access token |
| `POST` | `/logout` | Sí | Invalida la sesión |
| `GET` | `/me` | Sí | Datos del usuario autenticado |
| `GET` | `/mis-permisos` | Sí | Permisos especiales del usuario autenticado |
| `POST` | `/change-password` | Sí | Cambia la contraseña (requiere contraseña actual) |

#### Usuarios — `/api/usuarios`
Requiere al menos rol `project_admin`.

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/` | Lista usuarios (admin ve todos; project_admin solo sus técnicos) |
| `POST` | `/` | Crea usuario (admin: cualquier rol; project_admin: solo técnicos) |
| `PUT` | `/:id` | Actualiza usuario |
| `DELETE` | `/:id` | Elimina usuario (solo admin) |
| `GET` | `/:id/permisos-proyectos` | Proyectos asignados al técnico con su nivel |
| `PUT` | `/:id/permisos-proyectos` | Establece proyectos asignados al técnico |
| `GET` | `/:id/permisos-especiales` | Permisos especiales del técnico |
| `PUT` | `/:id/permisos-especiales` | Establece permisos especiales |
| `GET` | `/:id/proyectos` | Proyectos asignados a un project_admin (solo admin) |
| `GET` | `/:id/supervisores` | Supervisores de un técnico (solo admin) |
| `POST` | `/:id/supervisores` | Asigna un supervisor a un técnico (solo admin) |
| `DELETE` | `/:id/supervisores/:supervisorId` | Quita un supervisor (solo admin) |
| `GET` | `/:id/tareas` | Tareas asignadas al técnico |
| `GET` | `/:id/equipos-disponibles` | Equipos de los proyectos accesibles al técnico |

#### Proyectos — `/api/proyectos`

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/` | Lista proyectos visibles según el rol |
| `GET` | `/:id` | Obtiene un proyecto |
| `GET` | `/:id/equipos?estado=` | Equipos del proyecto con filtro de estado (`pendiente`, `en_proceso`, `terminado`, `archivado`) |
| `GET` | `/:id/todos-equipos` | Todos los equipos sin filtrar |
| `GET` | `/:id/asignaciones` | Técnicos con acceso al proyecto |
| `GET` | `/:id/permisos` | Permisos de técnicos en el proyecto |
| `PUT` | `/:id/permisos` | Establece permisos de técnicos en el proyecto |
| `POST` | `/` | Crea un proyecto (admin o project_admin) |
| `PUT` | `/:id` | Actualiza un proyecto |
| `DELETE` | `/:id` | Elimina un proyecto (solo admin) |

#### Equipos — `/api/equipos`

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/` | Lista equipos |
| `GET` | `/:id` | Obtiene un equipo |
| `POST` | `/` | Crea un equipo |
| `PUT` | `/:id` | Actualiza un equipo |
| `PUT` | `/:id/archivar` | Archiva/desarchiva un equipo |
| `DELETE` | `/:id` | Elimina un equipo |

#### Revisiones — `/api/revisiones`

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/` | Lista revisiones con filtros opcionales (`equipoId`, `tecnicoId`, `estado`) |
| `GET` | `/:id` | Obtiene una revisión |
| `POST` | `/` | Crea una revisión |
| `PUT` | `/:id` | Actualiza una revisión |
| `DELETE` | `/:id` | Elimina una revisión |

#### Plantillas — `/api/plantillas`

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/` | Lista plantillas |
| `GET` | `/:id` | Obtiene una plantilla |
| `POST` | `/` | Crea una plantilla |
| `PUT` | `/:id` | Actualiza una plantilla |
| `DELETE` | `/:id` | Elimina una plantilla |

#### Tareas Programadas — `/api/tareas`

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/` | Lista tareas (filtradas por rol) |
| `POST` | `/` | Crea una tarea programada |
| `PUT` | `/:id` | Actualiza una tarea |
| `DELETE` | `/:id` | Elimina una tarea |

#### Catálogos — `/api/catalogos`

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/` | Lista grupos con sus elementos |
| `POST` | `/` | Crea un grupo |
| `PUT` | `/:id` | Actualiza un grupo |
| `DELETE` | `/:id` | Elimina un grupo |
| `POST` | `/:grupoId/elementos` | Agrega un elemento al grupo |
| `PUT` | `/:grupoId/elementos/:elemId` | Actualiza un elemento |
| `DELETE` | `/:grupoId/elementos/:elemId` | Elimina un elemento |

#### Dashboard — `/api/dashboard`

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/` | Estadísticas generales (totales, estado de equipos, revisiones por día, top técnicos) |

#### Archivos — `/api/archivos`

Los archivos adjuntos se almacenan en `backend/data/archivos/` identificados por su hash SHA-256.

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/:hash` | Descarga un archivo por su hash |
| `POST` | `/upload` | Sube un archivo y devuelve su hash y URL |

#### Exportar — `/api/exportar` y `/api/proyectos/:id/exportar`

Permite exportar/importar proyectos completos como archivo ZIP o JSON.

#### Health Check — `GET /api/health`

```json
{
  "success": true,
  "app": "TechCheck",
  "version": "1.5.0",
  "entorno": "production",
  "dataSource": "sqlite"
}
```

---

## 6. Frontend — Angular 19

### 6.1 Módulos y Componentes

| Módulo | Ruta | Descripción |
|--------|------|-------------|
| `auth` | `/login` | Pantalla de inicio de sesión |
| `dashboard` | `/dashboard` | Estadísticas generales |
| `equipos` | `/equipos` | Proyectos y equipos (vista principal) |
| `revisiones` | `/revisiones` | Formulario de revisión |
| `historial` | `/historial` | Historial de revisiones completadas |
| `plantillas` | `/plantillas` | Gestión de plantillas |
| `usuarios` | `/usuarios` | Gestión de usuarios y permisos |
| `tareas` | `/tareas` | Tareas programadas |
| `catalogos` | `/catalogos` | Catálogos de valores |
| `exportar` | `/exportar` | Exportar e importar proyectos |

Todas las rutas usan **lazy loading** y están protegidas por un `AuthGuard` que redirige a `/login` si no hay sesión válida.

### 6.2 Modelos de Datos (TypeScript)

```typescript
// Roles disponibles
type UserRol = 'admin' | 'project_admin' | 'tecnico';

// Usuario
interface Usuario {
  id: string;
  nombre: string;
  username: string;     // usado para iniciar sesión
  rol: UserRol;
  activo: boolean;
  creadoEn: string;
}

// Permiso de técnico en un proyecto
interface ProyectoPermiso {
  tecnicoId: string;
  nivel: 'ver' | 'asignados' | 'editar';
}

// Equipo
interface Equipo {
  id: string;
  nombre: string;
  descripcion: string;
  items: ItemEquipo[];
  proyectoIds: string[];
  plantillaId: string | null;
  tecnicoAsignadoId: string | null;
  tecnicoAsignadoNombre?: string;
  archivado?: boolean;
  ultimaRevision?: Revision | null;
  totalRevisiones?: number;
  creadoEn: string;
  actualizadoEn: string;
}

// Revisión
interface Revision {
  id: string;
  equipoId: string;
  tecnicoId: string | null;
  tecnicoNombre: string;
  estado: 'ok' | 'observacion' | 'problema';
  items: ItemRevision[];
  observacionGeneral: string;
  fotos: (ArchivoAdjunto | string)[];
  creadoEn: string;
  actualizadoEn: string;
}
```

---

## 7. Sistema de Roles y Permisos

TechCheck tiene tres roles jerárquicos:

### `admin`
- Ve y gestiona todo el sistema
- Crea y elimina cualquier usuario (incluyendo otros admins)
- Asigna proyectos a project_admins
- Asigna supervisores a técnicos
- Accede a todos los proyectos sin restricción

### `project_admin`
- Gestiona los proyectos que le fueron asignados por un admin
- Crea técnicos (quedan automáticamente bajo su supervisión)
- Gestiona permisos de sus técnicos en sus proyectos
- No puede ver ni editar proyectos de otros project_admins

### `tecnico`
- Solo accede a los proyectos para los que tiene permiso explícito (`proyecto_permisos`)
- Su nivel de acceso por proyecto determina qué ve:
  - `ver` — ve todos los equipos del proyecto
  - `asignados` — solo ve los equipos donde él está marcado como `tecnicoAsignadoId`
  - `editar` — puede editar equipos (permisos equivalentes a project_admin en ese proyecto)
- Realiza revisiones sobre los equipos que puede ver

---

## 8. Autenticación

### Flujo de login

1. El cliente envía `POST /api/auth/login` con `{ username, password }`
2. El servidor valida con bcrypt y devuelve:
   - **Access token** (JWT, expira en 8h) en el body
   - **Refresh token** (aleatorio, expira en 7 días) en una cookie `HttpOnly`
3. El cliente guarda el access token en memoria y lo envía en cada petición como `Authorization: Bearer <token>`
4. Cuando el access token expira, el cliente llama `POST /api/auth/refresh` usando la cookie automáticamente
5. El refresh token se **rota** en cada uso (el anterior queda invalidado)

### Payload del JWT

```json
{ "sub": "<userId>", "rol": "admin | project_admin | tecnico" }
```

### Cambio de contraseña

`POST /api/auth/change-password` requiere la contraseña actual y la nueva (mínimo 8 caracteres). Al cambiar la contraseña se invalidan todos los refresh tokens del usuario.

---

## 9. Funcionalidades del Sistema

### Gestión de Proyectos
- Crear, editar y eliminar proyectos
- Asignar técnicos con nivel de acceso (`ver`, `asignados`, `editar`)
- Marcar proyectos como restringidos (solo técnicos con permiso explícito pueden verlos)

### Gestión de Equipos
- CRUD de equipos dentro de un proyecto
- Asignar técnico responsable (`tecnicoAsignadoId`)
- Aplicar plantillas de checklist
- Ítems con observación guía y archivos de referencia
- Archivar equipos sin eliminarlos
- Filtros por estado: `pendiente`, `en_proceso`, `terminado`, `archivado`

### Sistema de Revisiones
- Checklist interactivo por equipo
- Evidencia fotográfica por ítem y general
- Estados: `ok`, `observacion`, `problema`
- Retomar revisión incompleta (al guardar reemplaza la anterior)

### Tareas Programadas
- Definir revisiones recurrentes por equipo y técnico
- Configurar días de la semana y hora
- Fecha de fin opcional

### Catálogos
- Grupos de valores reutilizables en el sistema
- Administrados desde el módulo de Catálogos

### Dashboard
- Totales de proyectos, equipos, revisiones y técnicos
- Distribución de equipos por estado
- Revisiones por día (últimos 30 días)
- Top técnicos y top equipos por actividad

### Exportar e Importar
- Exportar proyecto completo como ZIP (incluye archivos adjuntos)
- Importar proyecto desde ZIP o JSON
- Los archivos adjuntos se deduplicaban por hash SHA-256

### Plantillas
- CRUD de plantillas de checklist
- Importar desde Excel (columnas: `nombre | descripcion | items`, ítems separados por `|`)

---

## 10. Instalación y Despliegue

### Requisitos

- Node.js **22** o superior (requerido por `node:sqlite`)
- npm 9 o superior

### Backend

```bash
cd techcheck/backend
npm install
node index.js
```

### Frontend (compilar)

```bash
cd techcheck/frontend
npm install
npx ng build --configuration=production
```

El build de producción queda en `frontend/dist/` y es servido automáticamente por el backend Express.

### Acceso

Abrir `http://localhost:3010` (o el puerto configurado en `.env`).

**Credenciales por defecto (primera vez):**
- Usuario: `admin`
- Contraseña: `admin1234`

> Cambiar la contraseña inmediatamente después del primer acceso desde el perfil o con `POST /api/auth/change-password`.

---

## 11. Docker

### Imágenes en Docker Hub

| Repositorio | Tag | Descripción |
|-------------|-----|-------------|
| `julianquintero/techcheck` | `1.5.0` / `latest` | Imagen oficial |
| `lacimarrona/todos-manager` | `techcheck-1.5.0` | Espejo alternativo |

### Levantar con Docker Compose

```bash
docker compose up -d
```

El archivo `docker-compose.yml` ya está configurado con:
- Puerto `3010` expuesto
- Volumen `./data` para persistir la BD y archivos adjuntos
- Health check automático

### Levantar solo con Docker

```bash
docker run -d \
  -p 3010:3010 \
  -v $(pwd)/data:/app/backend/data \
  --name techcheck \
  julianquintero/techcheck:1.5.0
```

---

## 12. Variables de Entorno

| Variable | Valor por defecto | Descripción |
|----------|------------------|-------------|
| `PORT` | `3010` | Puerto del servidor Express |
| `DATA_SOURCE` | `sqlite` | Fuente de datos (actualmente solo `sqlite`) |
| `JWT_SECRET` | `techcheck_secret_dev` | Clave secreta para firmar tokens JWT |
| `JWT_EXPIRES_IN` | `8h` | Duración del access token |
| `APP_NAME` | `TechCheck` | Nombre de la aplicación |
| `APP_VERSION` | `1.5.0` | Versión actual |
| `NODE_ENV` | `development` | Entorno (`development` o `production`) |

> En producción, definir `JWT_SECRET` con un valor aleatorio seguro (mínimo 32 caracteres).

---

*TechCheck v1.5.0 — Septiembre 2026*
