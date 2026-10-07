# TechCheck

**Checklists de mantenimiento técnico con evidencia, programación de tareas y trabajo sin conexión.**

**Versión:** 1.7.2 · **Fecha:** Octubre 2026

---

## Tabla de contenidos

1. [Qué es TechCheck](#1-qué-es-techcheck)
2. [Qué problema soluciona](#2-qué-problema-soluciona)
3. [Por qué usar TechCheck](#3-por-qué-usar-techcheck)
4. [Funcionalidades](#4-funcionalidades)
5. [Modo sin conexión (PWA)](#5-modo-sin-conexión-pwa)
6. [Roles y permisos](#6-roles-y-permisos)
7. [Arquitectura](#7-arquitectura)
8. [Estructura de directorios](#8-estructura-de-directorios)
9. [Base de datos — SQLite](#9-base-de-datos--sqlite)
10. [API REST](#10-api-rest)
11. [Frontend — Angular](#11-frontend--angular)
12. [Autenticación](#12-autenticación)
13. [Instalación y desarrollo local](#13-instalación-y-desarrollo-local)
14. [Despliegue con Docker](#14-despliegue-con-docker)
15. [Variables de entorno](#15-variables-de-entorno)
16. [Historial de versiones](#16-historial-de-versiones)

---

## 1. Qué es TechCheck

TechCheck es una aplicación web para que un equipo de soporte o mantenimiento organice, ejecute y deje constancia de las revisiones técnicas que hace sobre sus equipos: computadores, servidores, redes o cualquier activo que necesite una lista de verificación.

En la práctica:

- El **administrador** crea proyectos (por ejemplo, "Revisión de PC — Sede principal"), carga los equipos y define qué hay que revisar en cada uno: un checklist con guías, imágenes de referencia y catálogos de valores.
- Programa **cuándo** se debe revisar cada equipo: todas las semanas ciertos días, una sola vez con un plazo, o con una fecha límite.
- El **técnico** abre la app en el PC, la tablet o el celular, ve qué le toca hoy, marca cada punto como OK, Observación o Problema, escribe notas y toma fotos como evidencia. Puede hacerlo **sin internet** y los cambios se suben solos al reconectar.
- Todo queda en un **historial** con fecha, técnico y evidencia, que se puede exportar.

Se instala en un servidor propio (por ejemplo, un NAS con Docker) y se usa desde el navegador o instalada como app en cualquier dispositivo, sin pasar por tiendas de aplicaciones.

---

## 2. Qué problema soluciona

| Situación sin TechCheck | Con TechCheck |
|---|---|
| Los checklists viven en papel, Excel o chats; cada técnico revisa a su manera. | Cada equipo tiene **un checklist estándar**, con guías e imágenes de cómo hacer cada punto. |
| No hay forma de demostrar que una revisión se hizo ni cómo quedó el equipo. | Cada revisión guarda **quién, cuándo, el estado de cada punto, notas y fotos**. |
| Las revisiones periódicas dependen de la memoria; se olvidan y nadie se entera. | Las **tareas programadas** aparecen el día que tocan, y lo que no se hizo a tiempo queda en **"No ejecutadas"**. |
| En sitios sin señal (cuartos de servidores, sedes remotas) no se puede registrar nada y se transcribe después. | La app **funciona sin conexión** y sincroniza sola al volver la red. |
| Datos como marca, modelo o ubicación se escriben a mano y cada quien los escribe distinto. | Los **catálogos** obligan a elegir de una lista común, y se pueden predefinir por equipo. |
| Cualquiera ve o modifica todo, o se comparten usuarios. | **Roles y permisos por proyecto**: cada persona ve y hace solo lo que le corresponde. |
| La información queda dispersa y se pierde al cambiar de herramienta o de persona. | Todo está en **una base de datos propia**, con exportación a CSV, JSON y ZIP con imágenes. |

---

## 3. Por qué usar TechCheck

- **Trazabilidad real.** Cada revisión deja evidencia con fecha, responsable y fotos. Sirve para auditorías, para reclamos de garantía y para saber el historial de un equipo.
- **Nada se olvida.** Las tareas recurrentes y de fecha específica aparecen el día que tocan, y las vencidas quedan visibles en "No ejecutadas" en vez de perderse.
- **Trabajo en campo sin internet.** Es una PWA: se instala como app y permite hacer revisiones con fotos sin conexión. Al reconectar se suben solas, en orden, sin duplicarse y con la hora real en que se hicieron.
- **Estandarización.** Plantillas reutilizables, guías por ítem y catálogos de valores hacen que todos revisen lo mismo y registren los datos igual.
- **Un solo sistema para todos los dispositivos.** La misma app funciona en PC, tablet y celular. No hay que publicar en Play Store ni App Store, y las actualizaciones llegan solas.
- **Control de acceso.** Tres roles (administrador, administrador de proyecto y técnico) más permisos por proyecto y permisos especiales.
- **Datos propios.** Se aloja en la infraestructura de la organización (Docker, NAS o servidor propio). La información no depende de un servicio externo y no hay costo por usuario.
- **Fácil de operar.** Una sola imagen Docker, base de datos SQLite en un volumen y respaldo completo con un clic.

---

## 4. Funcionalidades

### Proyectos y equipos
- Proyectos con sus equipos (checklists). Un proyecto se puede marcar como restringido.
- Cada equipo tiene ítems de checklist con **observación guía** e **imágenes o archivos de referencia** (pegar con Ctrl+V, arrastrar o adjuntar).
- **Técnico asignado** opcional por equipo.
- **Fecha de vencimiento** opcional: si no se completa antes de esa fecha, el equipo pasa a "No ejecutadas" con la etiqueta *Vencimiento*.
- Crear equipos desde una **plantilla**, importarlos desde **Excel** y guardar un equipo como plantilla.
- **Archivar** equipos terminados sin eliminarlos y restaurarlos después.
- Pestañas por estado: **Tareas no iniciadas**, **En proceso**, **Terminados**, **Archivados**, **No ejecutadas** y **Tareas programadas**.
- **Vista por fecha** ("Hoy", con navegación día a día), que se puede desactivar para ver todo.
- Vistas en tarjetas, lista y tabla. Acciones secundarias (programar, plantilla, exportar, archivar, eliminar) en el menú **⋯**.

### Revisiones
- Checklist interactivo: cada ítem se marca y puede llevar estado **OK / Observación / Problema**, notas en varias líneas y fotos (cámara del celular o archivo).
- Estado general de la revisión, observación general y fotos de evidencia.
- **Retomar** una revisión en proceso: al reabrirla conserva lo que ya se hizo.
- Catálogos dentro de la revisión, en una sección propia sobre el checklist.
- **Historial** de revisiones con filtros (la exportación a CSV se hace desde *Exportar*).

### Tareas programadas
- **Recurrente:** días de la semana y hora, con fecha de inicio y de fin opcionales.
- **Fecha específica:** una sola vez, con **plazo en días**. La tarea aparece cada día desde la fecha indicada hasta su vencimiento (fecha + plazo − 1), y muestra "Vence …".
- Técnico responsable por tarea. Las tareas se pueden activar, desactivar o quitar; una tarea desactivada no aparece en ninguna vista.
- Al reactivar una tarea recurrente cuya fecha de fin ya pasó, la app advierte que no aparecerá y ofrece editarla.
- Un **proceso automático (cron, cada minuto, zona America/Bogota)**:
  - crea la revisión "en proceso" a la hora programada;
  - registra en **"No ejecutadas"** las tareas que vencieron sin revisión;
  - al arrancar, recupera lo que debió procesarse mientras el servidor estuvo apagado.

### Catálogos
- Grupos de valores (por ejemplo, *Marca*: Dell, HP, Lenovo) asignables a proyectos.
- En un equipo se **asocia** un catálogo y opcionalmente se **predefine su valor**, que llega ya elegido a la revisión.
- Las tarjetas muestran el valor elegido como etiqueta (📚 Marca: Dell), tomado de la última revisión o del valor predefinido.
- Cada elemento se puede **desactivar** sin borrarlo: deja de ofrecerse, pero donde ya estaba guardado se sigue viendo como "(desactivado)" para no perder la trazabilidad.

### Plantillas
- Plantillas de checklist reutilizables, con guías, archivos y catálogos.
- Asignables a proyectos e importables desde Excel o ZIP.
- **Sincronizar** cambios de una plantilla hacia los equipos que la usan.

### Usuarios
- Gestión de usuarios y roles, proyectos asignados con nivel de acceso, supervisores y permisos especiales (ver [Roles y permisos](#6-roles-y-permisos)).

### Exportar, importar y respaldo
- Exportar revisiones a **CSV** y proyectos a **JSON** o **ZIP con imágenes**.
- Importar proyectos desde JSON o ZIP.
- **Backup completo** en ZIP y restauración.
- Archivos almacenados por hash SHA-256, sin duplicados.

### Interfaz
- Diseño adaptado a celular, tablet y escritorio.
- Modo claro y oscuro.
- Confirmaciones propias de la app (por ejemplo, "¿Salir sin guardar?") en vez de los diálogos del navegador.

---

## 5. Modo sin conexión (PWA)

TechCheck es una **Progressive Web App**. No es un APK: se abre en el navegador y se instala desde él con **"Instalar app"** o **"Agregar a pantalla de inicio"**.

### Qué funciona sin conexión

| Funciona sin conexión | Necesita conexión |
|---|---|
| Abrir la app (también tras cerrarla) | Iniciar sesión por primera vez en el dispositivo |
| Ver proyectos, equipos, catálogos y plantillas ya descargados | Crear o editar equipos, tareas, catálogos, plantillas y usuarios |
| Hacer y retomar revisiones, con notas, estados, catálogos y fotos | Exportar e importar |

### Cómo funciona

1. **App guardada en el dispositivo.** El service worker de Angular guarda los archivos de la app. Si hay una versión nueva, aparece **"Hay una versión nueva · Actualizar"**.
2. **Datos guardados.** Al iniciar sesión con conexión, la app descarga proyectos, equipos (todas las pestañas), catálogos, plantillas y técnicos en **IndexedDB**. Sin conexión, las lecturas usan esa copia y la franja amarilla indica la fecha de la última descarga.
3. **Cola de cambios.** Las revisiones y fotos hechas sin conexión se guardan en una cola local. El equipo muestra **☁ Sin sincronizar** y la franja indica cuántos cambios hay por subir.
4. **Sincronización.** Al volver la conexión (se comprueba al reconectar, cada 30 s o con "Reintentar"), la cola se sube en orden:
   - Las fotos se suben primero como archivos.
   - La revisión conserva su **ID y hora reales**; si se reenvía, el servidor no la duplica.
   - Si el servidor rechaza un cambio (por ejemplo, porque el equipo fue eliminado), se muestra en rojo con la opción **Descartar**.
5. **Sesión sin conexión.** Si no hay servidor, la app entra con el último usuario que inició sesión en ese dispositivo. Al pulsar **"Salir"** se borra ese acceso.

### Requisitos y limitaciones

- **HTTPS obligatorio** para instalar la app y abrirla sin conexión, o `localhost` en desarrollo. Por `http://IP` la app funciona igual, pero solo guarda cambios sin conexión mientras la página siga abierta.
- La sincronización ocurre **mientras la app está abierta**. Lo pendiente se sube la próxima vez que se abra con conexión.
- **iPhone/iPad:** la app instalada y Safari no comparten datos; hay que iniciar sesión dentro de la app instalada. Safari puede borrar los datos locales si la app no se usa en varias semanas.
- Si dos personas editan la misma revisión sin conexión, prevalece la última que se sube.

---

## 6. Roles y permisos

| | Administrador | Admin. de proyecto | Técnico |
|---|:-:|:-:|:-:|
| Ver proyectos | Todos | Los asignados | Con permiso explícito |
| Crear y editar proyectos | ✓ | En sus proyectos | — |
| Crear y editar equipos (checklists) | ✓ | ✓ | ✓ ¹ |
| Hacer revisiones | ✓ | ✓ | ✓ |
| Programar tareas | ✓ | ✓ | Con permiso especial |
| Plantillas | ✓ | ✓ | Con permiso especial |
| Usuarios | Todos | Sus técnicos | — |
| Catálogos, Técnicos, Exportar / Backup | ✓ | — | — |

¹ Hoy los botones **+ Nuevo checklist** y **Editar** están disponibles para todos los roles con acceso al proyecto, y el backend no restringe esa acción por rol. Programar, guardar como plantilla y eliminar sí están limitados.

### Nivel de acceso de un técnico por proyecto (`proyecto_permisos`)
- `ver` — todas las tareas del proyecto.
- `asignados` — solo los equipos donde es el técnico asignado.
- `editar` — permisos equivalentes a un administrador de proyecto en ese proyecto.

### Permisos especiales del técnico (`usuario_permisos`)
- `asignar_tareas` — programar tareas.
- `editar_plantillas` — crear y editar plantillas.
- `eliminar_plantillas` — eliminar plantillas.

---

## 7. Arquitectura

```
┌───────────────────────────────────────────────────────────┐
│  NAVEGADOR / APP INSTALADA (PC, tablet, celular)           │
│                                                            │
│  Angular 21 (SPA, PWA)                                     │
│  ├── Service worker  → app guardada, fotos en caché        │
│  ├── IndexedDB       → datos descargados + cola offline    │
│  └── Interceptores   → token JWT · modo sin conexión       │
└───────────────────────────┬───────────────────────────────┘
                            │ HTTPS / REST (Authorization: Bearer)
┌───────────────────────────▼───────────────────────────────┐
│  BACKEND — Node.js + Express 4                             │
│  Middleware: auth · roles · acceso a proyectos             │
│  Rutas /api/*  ·  cron de tareas (cada minuto)             │
│  db/dataAccess.js (capa de datos)                          │
│  Sirve también el frontend compilado                       │
└───────────────────────────┬───────────────────────────────┘
                            │ node:sqlite
┌───────────────────────────▼───────────────────────────────┐
│  data/techcheck.db (SQLite)  ·  data/archivos/ (adjuntos)  │
└────────────────────────────────────────────────────────────┘
```

### Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | Angular 21, Tailwind CSS 3, `@angular/service-worker` |
| Backend | Node.js ≥ 22, Express 4, node-cron |
| Base de datos | SQLite con el módulo nativo `node:sqlite` |
| Autenticación | JWT + refresh token en cookie HttpOnly, bcrypt |
| Contenedor | Docker (imagen única: frontend + backend) |

---

## 8. Estructura de directorios

```
techcheck/
├── Dockerfile                    ← Build en 2 etapas (frontend + servidor)
├── docker-compose.yml
├── docker-entrypoint.sh
├── backend/
│   ├── index.js                  ← Servidor Express (API + frontend)
│   ├── data/                     ← Volumen persistente
│   │   ├── techcheck.db          ← Base de datos SQLite
│   │   └── archivos/             ← Adjuntos por proyecto y hash SHA-256
│   ├── db/
│   │   ├── sqlite.js             ← Esquema y migraciones automáticas
│   │   ├── dataAccess.js         ← Capa de acceso a datos
│   │   └── migrate.js            ← Migración JSON → SQLite
│   ├── jobs/
│   │   └── tareas-cron.js        ← Tareas programadas y "no ejecutadas"
│   ├── middleware/               ← auth.js · roles.js · proyectoAccess.js
│   └── routes/                   ← auth, usuarios, proyectos, equipos, revisiones,
│                                    plantillas, tareas, catalogos, tecnicos,
│                                    archivos, exportar, dashboard
└── frontend/
    ├── angular.json
    ├── ngsw-config.json          ← Configuración del service worker
    ├── public/
    │   ├── manifest.webmanifest  ← Manifest de la PWA
    │   └── icons/                ← Íconos de la app instalable
    └── src/app/
        ├── core/
        │   ├── models/           ← Interfaces TypeScript
        │   ├── services/         ← Servicios HTTP, auth, confirmación
        │   ├── guards/           ← authGuard, roleGuard
        │   ├── interceptors/     ← JWT
        │   └── offline/          ← IndexedDB, cola, sincronización
        ├── shared/               ← Aviso de conexión, diálogo de confirmación
        └── modules/              ← auth, equipos, revisiones, historial, tareas,
                                     plantillas, usuarios, tecnicos, catalogos, exportar
```

---

## 9. Base de datos — SQLite

La base vive en `backend/data/techcheck.db`. Se crea y migra automáticamente al arrancar el servidor; las columnas nuevas se agregan sin perder datos.

| Tabla | Contenido |
|---|---|
| `proyectos` | Proyectos |
| `equipos` | Equipos/checklists: ítems (JSON), técnico asignado, fecha de vencimiento, archivado |
| `revisiones` | Revisiones: estado, ítems con estado, notas, valor de catálogo y archivos, fotos |
| `plantillas`, `plantilla_proyectos` | Plantillas y su asignación a proyectos |
| `tareas_programadas` | Tareas: tipo (`recurrente` / `fecha_especifica`), días, hora, fechas, plazo, activa |
| `tareas_no_cumplidas` | Tareas que vencieron sin revisión ("No ejecutadas") |
| `grupos_elemento`, `elementos_grupo` | Catálogos y sus elementos (con estado activo/inactivo) |
| `catalogo_proyectos` | Catálogos asignados a proyectos |
| `usuarios` | Usuarios, rol y contraseña (bcrypt) |
| `refresh_tokens` | Tokens de refresco (rotación) |
| `proyecto_permisos` | Nivel de acceso de técnicos por proyecto |
| `proyecto_asignaciones` | Administradores de proyecto asignados a proyectos |
| `tecnico_supervisores` | Relación técnico ↔ administrador de proyecto |
| `usuario_permisos` | Permisos especiales de técnicos |
| `tecnicos` | Tabla heredada de versiones anteriores |

---

## 10. API REST

Todas las rutas, salvo `/api/auth/*` (excepto `me`, `logout` y `mis-permisos`), `GET /api/archivos/*` y `/api/health`, requieren `Authorization: Bearer <token>`.

### Auth — `/api/auth`
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/setup-needed` | Indica si falta crear el primer administrador |
| POST | `/setup` | Crea el primer administrador (solo si no existe ninguno) |
| POST | `/login` | Inicia sesión; devuelve access token y fija la cookie de refresh |
| POST | `/refresh` | Rota el refresh token y devuelve un nuevo access token |
| POST | `/logout` | Cierra la sesión |
| GET | `/me` | Usuario autenticado |
| GET | `/mis-permisos` | Permisos especiales del usuario |
| POST | `/change-password` | Cambia la contraseña |

### Proyectos — `/api/proyectos`
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` | Proyectos visibles según el rol |
| GET / POST / PUT / DELETE | `/:id` · `/` | Consultar, crear, editar y eliminar |
| GET | `/:id/equipos?estado=` | Equipos por pestaña: `pendiente`, `en_proceso`, `terminado`, `archivado`, `tareas_programadas` |
| GET | `/:id/todos-equipos` | Todos los equipos sin filtrar |
| GET | `/:id/tareas-no-cumplidas` | "No ejecutadas" (incluye equipos vencidos) |
| GET / PUT | `/:id/permisos` | Permisos de técnicos en el proyecto |
| GET / POST / DELETE | `/:id/asignaciones[/:usuarioId]` | Administradores de proyecto asignados |
| GET | `/:id/exportar` · `/:id/exportar-zip` | Exportar proyecto (JSON / ZIP con imágenes) |
| POST | `/importar` · `/importar-zip` | Importar proyecto |
| POST | `/restaurar-backup` | Restaurar backup completo |

### Equipos — `/api/equipos`
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` · `/:id` | Listar / consultar |
| POST | `/` | Crear (acepta `plantillaId`, `tecnicoAsignadoId`, `fechaVencimiento`) |
| PUT | `/:id` | Editar (nombre, descripción, ítems, técnico, `fechaVencimiento`) |
| PUT | `/:id/archivar` · `/:id/desarchivar` | Archivar / restaurar |
| DELETE | `/:id` | Eliminar |

### Revisiones — `/api/revisiones`
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` | Listar (filtros `equipoId`, `tecnicoId`, `estado`) |
| GET | `/:id` | Consultar |
| POST | `/` | Crear. Acepta `id` (UUID) y `creadoEn` del dispositivo; si el `id` ya existe devuelve la existente (no duplica) |
| PUT | `/:id` | Actualizar |
| DELETE | `/:id` | Eliminar |

### Tareas programadas — `/api/tareas`
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` · `/:id` | Listar / consultar |
| POST | `/` | Crear (`tipo`, `diasSemana`, `hora`, `fechaInicio`, `fechaFin`, `fechaEspecifica`, `plazo` 1–365) |
| PUT | `/:id` | Editar |
| PUT | `/:id/toggle` | Activar / desactivar |
| DELETE | `/:id` | Eliminar |

### Catálogos — `/api/catalogos`
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` | Catálogos con sus elementos (filtrados por rol) |
| POST / PUT / DELETE | `/` · `/:id` | Crear, editar y eliminar catálogos |
| GET / PUT | `/:id/proyectos` | Proyectos del catálogo |
| GET / POST | `/:grupoId/elementos` | Elementos del catálogo |
| PUT / DELETE | `/:grupoId/elementos/:id` | Editar (incluye `activo`) / eliminar elemento |

### Plantillas — `/api/plantillas`
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` · `/:id` · `/por-proyecto/:proyectoId` | Listar / consultar |
| POST / PUT / DELETE | `/` · `/:id` | Crear, editar y eliminar |
| GET / PUT | `/:id/proyectos` | Proyectos de la plantilla |
| GET | `/:id/equipos` | Equipos que usan la plantilla |
| POST | `/:id/sincronizar-equipos` | Aplicar cambios de la plantilla a sus equipos |
| GET / POST | `/:id/exportar-zip` · `/importar-zip` | Exportar / importar |

### Usuarios — `/api/usuarios`
| Método | Ruta | Descripción |
|---|---|---|
| GET / POST | `/` | Listar / crear (el email es opcional) |
| PUT / DELETE | `/:id` | Editar / eliminar |
| GET / PUT | `/:id/permisos-proyectos` | Proyectos y nivel de acceso del técnico |
| GET / PUT | `/:id/permisos-especiales` | Permisos especiales |
| GET | `/:id/proyectos` · `/:id/tareas` · `/:id/equipos-disponibles` | Datos del usuario |
| GET / POST / DELETE | `/:id/supervisores[/:supervisorId]` | Supervisores |

### Otros
| Ruta | Descripción |
|---|---|
| `/api/archivos` | `POST /` sube un archivo (opcional `proyectoId`); `GET /:proyectoId/:hash` y `GET /:hash` lo sirven |
| `/api/exportar` | `GET /revisiones-csv`, `GET /json`, `POST /importar-json` (solo admin) |
| `/api/tecnicos` | CRUD de la tabla heredada `tecnicos` |
| `/api/dashboard` | Estadísticas generales (solo admin) |
| `GET /api/health` | Estado del servicio, versión y fuente de datos |

---

## 11. Frontend — Angular

| Ruta | Pantalla | Acceso |
|---|---|---|
| `/auth/login` | Inicio de sesión y creación del primer administrador | Público |
| `/equipos` | Proyectos, equipos, revisiones y tareas (vista principal) | Con sesión |
| `/revisiones` | Formulario de revisión | Con sesión |
| `/historial` | Historial de revisiones | Con sesión |
| `/tareas` | Tareas programadas | Todos los roles |
| `/plantillas` | Plantillas | Todos los roles |
| `/usuarios` | Usuarios y permisos | Admin y admin. de proyecto |
| `/tecnicos` · `/catalogos` · `/exportar` | Técnicos, catálogos, exportar y backup | Admin |

- Las rutas usan *lazy loading*. `authGuard` valida la sesión (o la restaura sin conexión) y `roleGuard` valida el rol, esperando a que la sesión cargue cuando se recarga la página.
- Los interceptores HTTP agregan el token y aplican la lógica sin conexión (`core/offline/offline.interceptor.ts`).
- El service worker solo se activa en el build de producción.

---

## 12. Autenticación

1. **Primer uso:** si no existe ningún administrador, la pantalla de inicio pide crearlo (`/api/auth/setup`). No hay credenciales por defecto.
2. **Login:** `POST /api/auth/login` con `{ username, password }` (el usuario se guarda en minúsculas). Devuelve:
   - **Access token** JWT (por defecto 8 h, configurable con `JWT_EXPIRES_IN`) con `{ sub, rol }`.
   - **Refresh token** de 7 días en la cookie HttpOnly `tc_refresh`, que **rota** en cada uso.
3. El frontend envía `Authorization: Bearer <token>` y, ante un 401, renueva la sesión automáticamente con `/refresh`.
4. **Sin conexión:** si el servidor no responde, la app entra con el último usuario del dispositivo y no cierra la sesión por errores de red.
5. **Cambio de contraseña:** `POST /api/auth/change-password` (mínimo 8 caracteres) invalida los refresh tokens del usuario.

---

## 13. Instalación y desarrollo local

**Requisitos:** Node.js 22 o superior (por `node:sqlite`) y npm.

```bash
# Backend
cd techcheck/backend
npm install

# Frontend
cd ../frontend
npm install
npx ng build --configuration production   # incluye el service worker
```

Arrancar el servidor, que sirve API y frontend:

```bash
cd techcheck/backend
DATA_SOURCE=sqlite PORT=3010 node index.js
```

En PowerShell:

```powershell
$env:DATA_SOURCE='sqlite'; $env:PORT='3010'; node index.js
```

Abrir `http://localhost:3010`. La primera vez se crea el administrador.

> Sin `DATA_SOURCE=sqlite` el servidor arranca en modo JSON heredado y no muestra los datos de SQLite.
> Para probar la PWA en local use el build de **producción** y `localhost`; el build de desarrollo no registra el service worker.

---

## 14. Despliegue con Docker

### Imágenes publicadas

| Repositorio | Tags |
|---|---|
| `julianquintero/techcheck` | `1.7.2`, `latest` |
| `lacimarrona/todos-manager` | `1.7.2`, `latest` |

### Docker Compose

```bash
docker compose up -d
```

El `docker-compose.yml` incluido:
- expone el puerto `3010`;
- usa el **volumen con nombre `techcheck_data`** montado en `/app/backend/data`, que conserva la base de datos y los adjuntos entre actualizaciones;
- define `DATA_SOURCE=sqlite`, `NODE_ENV=production` y un *health check* sobre `/api/health`.

### Actualizar a una versión nueva

```bash
docker compose pull && docker compose up -d
```

Los usuarios verán en la app el aviso **"Hay una versión nueva · Actualizar"**.

### Producción con HTTPS

Para que la PWA se pueda instalar y funcione sin conexión, publique la app con un **dominio y HTTPS**, por ejemplo con un proxy inverso (Cloudflare, Nginx, Caddy o el proxy del NAS) apuntando al puerto `3010`.

---

## 15. Variables de entorno

| Variable | Por defecto | Descripción |
|---|---|---|
| `PORT` | `3000` (`3010` en Docker) | Puerto del servidor |
| `DATA_SOURCE` | `json` | Use **`sqlite`** |
| `JWT_SECRET` | `techcheck_secret_dev` | Clave para firmar los JWT. **Cámbiela en producción** (32+ caracteres aleatorios) |
| `JWT_EXPIRES_IN` | `8h` | Duración del access token |
| `APP_NAME` | `TechCheck` | Nombre mostrado en `/api/health` |
| `APP_VERSION` | `1.0.0` | Versión mostrada en `/api/health` |
| `NODE_ENV` | `development` | `production` en despliegue |

---

## 16. Historial de versiones

| Versión | Fecha | Cambios principales |
|---|---|---|
| 1.7.2 | 2026-09-28 | Se guardan la fecha de vencimiento de equipos y el plazo de tareas; ya no se ocultan pendientes por registros viejos de "No ejecutadas"; el login sin conexión avisa que falta conexión; recargar una pantalla por rol ya no redirige al inicio |
| 1.7.1 | 2026-09-25 | Crear usuarios sin email ya no falla |
| 1.7.0 | 2026-09-25 | PWA instalable con modo sin conexión: revisiones y fotos offline, sincronización automática, sesión sin conexión |
| 1.6.2 | 2026-09-25 | Valor predefinido de catálogo, activar/desactivar elementos, etiquetas de catálogo, menú ⋯, revisión adaptada a móvil, confirmación propia de la app |
| 1.6.x | 2026-09-21 / 24 | Tareas unificadas (recurrente / fecha específica), fecha de inicio, plazo, vencimiento de equipos, catálogos separados del checklist |
| 1.5.x | 2026-09-17 / 21 | Diseño adaptable, cámara en móvil, "No ejecutadas" y recuperación tras caídas, catálogos en plantillas y revisiones, backup completo en ZIP |

---

*TechCheck v1.7.2 — Octubre 2026*
