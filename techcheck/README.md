# TechCheck — Documentación Técnica Completa

**Versión:** 1.0.0  
**Fecha:** Junio 2026  
**Entorno:** Windows 11 — Zona Franca Rionegro, Antioquia, Colombia

---

## Tabla de Contenidos

1. [Descripción General](#1-descripción-general)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Estructura de Directorios](#3-estructura-de-directorios)
4. [Backend — Node.js / Express](#4-backend--nodejs--express)
   - 4.1 [Configuración (.env)](#41-configuración-env)
   - 4.2 [Punto de Entrada (index.js)](#42-punto-de-entrada-indexjs)
   - 4.3 [Capa de Acceso a Datos (dataAccess.js)](#43-capa-de-acceso-a-datos-dataaccessjs)
   - 4.4 [Rutas API](#44-rutas-api)
   - 4.5 [Almacenamiento de Datos](#45-almacenamiento-de-datos)
5. [Frontend — Angular 19](#5-frontend--angular-19)
   - 5.1 [Módulos y Componentes](#51-módulos-y-componentes)
   - 5.2 [Modelos de Datos (TypeScript)](#52-modelos-de-datos-typescript)
   - 5.3 [Servicios](#53-servicios)
   - 5.4 [Rutas del Frontend](#54-rutas-del-frontend)
6. [Funcionalidades del Sistema](#6-funcionalidades-del-sistema)
   - 6.1 [Gestión de Proyectos](#61-gestión-de-proyectos)
   - 6.2 [Gestión de Equipos](#62-gestión-de-equipos)
   - 6.3 [Sistema de Revisiones](#63-sistema-de-revisiones)
   - 6.4 [Plantillas de Checklist](#64-plantillas-de-checklist)
   - 6.5 [Gestión de Técnicos](#65-gestión-de-técnicos)
   - 6.6 [Historial de Revisiones](#66-historial-de-revisiones)
   - 6.7 [Exportar e Importar Proyectos](#67-exportar-e-importar-proyectos)
7. [API REST — Referencia Completa](#7-api-rest--referencia-completa)
8. [Flujo de Datos](#8-flujo-de-datos)
9. [Instalación y Despliegue](#9-instalación-y-despliegue)
10. [Variables de Entorno](#10-variables-de-entorno)
11. [Guía de Uso](#11-guía-de-uso)
12. [Hoja de Ruta (Roadmap)](#12-hoja-de-ruta-roadmap)

---

## 1. Descripción General

**TechCheck** es una aplicación web de gestión de checklists de mantenimiento técnico desarrollada para uso interno en entornos empresariales, especialmente orientada a equipos de soporte de TI.

### Propósito

Permite a los equipos técnicos:
- Organizar el mantenimiento de equipos por proyectos
- Crear checklists reutilizables (plantillas)
- Registrar revisiones con evidencia fotográfica y archivos adjuntos
- Hacer seguimiento del estado de mantenimiento (Pendiente, En proceso, Terminado)
- Asignar técnicos a equipos
- Exportar e importar proyectos completos

### Tecnologías

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Frontend | Angular | 19 |
| Estilos | Tailwind CSS | 3.x |
| Backend | Node.js + Express | 4.x |
| Almacenamiento | JSON local (archivos) | — |
| ID único | UUID v4 | 9.x |
| Configuración | dotenv | 16.x |

---

## 2. Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────┐
│                   NAVEGADOR WEB                      │
│                                                      │
│   Angular 19 (SPA)                                   │
│   ├── Módulo Proyectos / Equipos                     │
│   ├── Módulo Plantillas                              │
│   ├── Módulo Técnicos                                │
│   └── Módulo Historial                               │
└────────────────────┬────────────────────────────────┘
                     │ HTTP / REST API
                     │ puerto configurable (.env)
┌────────────────────▼────────────────────────────────┐
│              BACKEND — Express.js                    │
│                                                      │
│   /api/proyectos   /api/equipos   /api/revisiones    │
│   /api/plantillas  /api/tecnicos                     │
│                                                      │
│   dataAccess.js (capa de abstracción de datos)       │
└────────────────────┬────────────────────────────────┘
                     │ fs (sistema de archivos)
┌────────────────────▼────────────────────────────────┐
│              ALMACENAMIENTO JSON                     │
│                                                      │
│   data/global.json          ← proyectos, técnicos,  │
│                                plantillas            │
│   data/proyectos/           ← un archivo por        │
│     {proyectoId}.json          proyecto              │
│       ├── equipos[]                                  │
│       └── revisiones[]                               │
└─────────────────────────────────────────────────────┘
```

La arquitectura sigue un patrón **monolítico desacoplado**:
- El frontend compilado es servido estáticamente por el mismo servidor Express
- La capa `dataAccess.js` abstrae completamente el origen de datos, preparada para migración futura a PostgreSQL

---

## 3. Estructura de Directorios

```
techcheck/
├── start.bat                          ← Script de inicio Windows
├── backend/
│   ├── .env                           ← Variables de entorno
│   ├── index.js                       ← Servidor Express
│   ├── package.json
│   ├── data/
│   │   ├── global.json                ← Proyectos, técnicos, plantillas
│   │   └── proyectos/
│   │       └── {uuid}.json            ← Equipos + revisiones por proyecto
│   ├── db/
│   │   └── dataAccess.js              ← Capa de acceso a datos
│   └── routes/
│       ├── proyectos.js
│       ├── equipos.js
│       ├── plantillas.js
│       ├── tecnicos.js
│       └── revisiones.js
└── frontend/
    ├── angular.json
    ├── package.json
    ├── tailwind.config.js
    ├── src/
    │   ├── index.html                 ← Incluye XLSX CDN
    │   ├── main.ts
    │   ├── styles.scss
    │   ├── environments/
    │   │   ├── environment.ts
    │   │   └── environment.prod.ts
    │   └── app/
    │       ├── app.ts                 ← Layout + sidebar
    │       ├── app.routes.ts
    │       ├── app.config.ts
    │       ├── core/
    │       │   ├── models/
    │       │   │   └── models.ts      ← Interfaces TypeScript
    │       │   └── services/
    │       │       ├── proyectos.service.ts
    │       │       ├── equipos.service.ts
    │       │       ├── plantillas.service.ts
    │       │       └── otros.services.ts
    │       ├── shared/
    │       │   └── done.pipe.ts       ← Pipe para contar ítems completados
    │       └── modules/
    │           ├── equipos/
    │           ├── plantillas/
    │           ├── tecnicos/
    │           ├── historial/
    │           └── revisiones/
    └── dist/                          ← Build de producción (generado)
```

---

## 4. Backend — Node.js / Express

### 4.1 Configuración (.env)

```env
# ─── SERVIDOR ───────────────────────────────────────────────
PORT=3000

# ─── ALMACENAMIENTO ─────────────────────────────────────────
# json = archivos locales (actual)
# postgres = base de datos PostgreSQL (futuro)
DATA_SOURCE=json

# ─── BASE DE DATOS (para migración futura a PostgreSQL) ──────
DB_HOST=localhost
DB_PORT=5432
DB_NAME=techcheck
DB_USER=postgres
DB_PASSWORD=

# ─── SEGURIDAD (para autenticación futura) ───────────────────
JWT_SECRET=techcheck_secret_key
JWT_EXPIRES_IN=8h

# ─── APLICACIÓN ─────────────────────────────────────────────
APP_NAME=TechCheck
APP_VERSION=1.0.0
NODE_ENV=development
```

> **Nota:** Para cambiar el puerto, modificar `PORT` y reiniciar el servidor.

### 4.2 Punto de Entrada (index.js)

El servidor Express:
- Carga variables de entorno con `dotenv`
- Configura CORS y límite de 50MB para JSON (necesario por imágenes en base64)
- Registra todas las rutas bajo el prefijo `/api/`
- Sirve el frontend compilado de Angular de forma estática
- Redirige todas las rutas no-API al `index.html` para el enrutamiento SPA

### 4.3 Capa de Acceso a Datos (dataAccess.js)

Esta capa es el núcleo del almacenamiento. Abstrae completamente el acceso a datos del resto de la aplicación.

#### Estructura de almacenamiento

**`data/global.json`** — Datos globales compartidos:
```json
{
  "proyectos": [...],
  "tecnicos": [...],
  "plantillas": [...]
}
```

**`data/proyectos/{id}.json`** — Datos específicos de cada proyecto:
```json
{
  "equipos": [...],
  "revisiones": [...]
}
```

#### Funciones exportadas

| Función | Descripción |
|---------|-------------|
| `getProyectos()` | Lista todos los proyectos |
| `getProyectoById(id)` | Obtiene un proyecto por ID |
| `createProyecto(obj)` | Crea proyecto + archivo JSON vacío |
| `updateProyecto(id, datos)` | Actualiza campos del proyecto |
| `deleteProyecto(id)` | Elimina proyecto y su archivo JSON |
| `getEquipos()` | Lista equipos de todos los proyectos |
| `getEquiposByProyecto(proyectoId)` | Equipos de un proyecto específico |
| `createEquipo(equipo)` | Agrega equipo al JSON del proyecto |
| `updateEquipo(id, datos)` | Actualiza equipo buscando en todos los proyectos |
| `deleteEquipo(id)` | Elimina equipo y su archivo |
| `getRevisiones(filtros)` | Lista revisiones con filtros opcionales |
| `createRevision(revision)` | Guarda revisión en el JSON del proyecto del equipo |
| `exportarProyecto(id)` | Genera objeto completo con proyecto, equipos, revisiones, técnicos |
| `importarProyecto(datos)` | Importa un proyecto con nuevos IDs |

### 4.4 Rutas API

#### Proyectos — `/api/proyectos`

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/` | Lista todos los proyectos con total de equipos |
| `GET` | `/:id` | Obtiene un proyecto por ID |
| `GET` | `/:id/equipos?estado=` | Lista equipos del proyecto con filtro de estado |
| `GET` | `/:id/todos-equipos` | Lista todos los equipos sin filtrar (para historial) |
| `GET` | `/:id/exportar` | Exporta el proyecto completo como JSON |
| `POST` | `/` | Crea un nuevo proyecto |
| `POST` | `/importar` | Importa un proyecto desde JSON |
| `PUT` | `/:id` | Actualiza un proyecto |
| `DELETE` | `/:id` | Elimina un proyecto |

**Filtros de estado para `/:id/equipos?estado=`:**

| Valor | Descripción |
|-------|-------------|
| `pendiente` | Equipos sin ninguna revisión o sin ítems marcados |
| `en_proceso` | Equipos con al menos 1 ítem marcado pero no todos |
| `terminado` | Equipos con todos los ítems marcados al 100% |

#### Equipos — `/api/equipos`

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/` | Lista todos los equipos |
| `GET` | `/:id` | Obtiene un equipo por ID |
| `POST` | `/` | Crea un nuevo equipo |
| `PUT` | `/:id` | Actualiza un equipo |
| `DELETE` | `/:id` | Elimina un equipo |

#### Revisiones — `/api/revisiones`

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/` | Lista revisiones con filtros opcionales (`equipoId`, `tecnicoId`, `estado`) |
| `GET` | `/:id` | Obtiene una revisión por ID |
| `POST` | `/` | Crea una nueva revisión |
| `PUT` | `/:id` | Actualiza una revisión |
| `DELETE` | `/:id` | Elimina una revisión |

#### Plantillas — `/api/plantillas`

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/` | Lista todas las plantillas |
| `GET` | `/:id` | Obtiene una plantilla por ID |
| `POST` | `/` | Crea una nueva plantilla |
| `PUT` | `/:id` | Actualiza una plantilla |
| `DELETE` | `/:id` | Elimina una plantilla |

#### Técnicos — `/api/tecnicos`

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/` | Lista todos los técnicos |
| `POST` | `/` | Crea un nuevo técnico |
| `PUT` | `/:id` | Actualiza un técnico |
| `DELETE` | `/:id` | Elimina un técnico |

#### Health Check — `/api/health`

```json
{
  "success": true,
  "app": "TechCheck",
  "version": "1.0.0",
  "entorno": "development",
  "dataSource": "json",
  "mensaje": "TechCheck API funcionando"
}
```

### 4.5 Almacenamiento de Datos

#### Estructura del equipo en JSON

```json
{
  "id": "uuid-v4",
  "nombre": "PC-Recepcion",
  "descripcion": "Dell OptiPlex 7090",
  "items": [
    {
      "label": "Verificar antivirus",
      "observacionGuia": "Abrir Avast y verificar ultima actualizacion",
      "archivosGuia": ["data:image/png;base64,..."]
    }
  ],
  "plantillaId": "uuid-plantilla | null",
  "proyectoIds": ["uuid-proyecto"],
  "tecnicoAsignadoId": "uuid-tecnico | null",
  "tiempoLimite": 3,
  "unidadTiempo": "horas | dias",
  "iniciadoEn": "2026-06-10T10:00:00.000Z",
  "terminadoEn": null,
  "creadoEn": "2026-06-01T00:00:00.000Z",
  "actualizadoEn": "2026-06-01T00:00:00.000Z"
}
```

#### Estructura de la revisión en JSON

```json
{
  "id": "uuid-v4",
  "equipoId": "uuid-equipo",
  "tecnicoId": "uuid-tecnico | null",
  "tecnicoNombre": "Juan Pérez",
  "estado": "ok | observacion | problema",
  "items": [
    {
      "label": "Verificar antivirus",
      "checked": true,
      "nota": "Actualizado a versión 22.x",
      "archivos": ["data:image/png;base64,..."],
      "observacionGuia": "...",
      "archivosGuia": [...]
    }
  ],
  "observacionGeneral": "Todo en orden",
  "fotos": ["data:image/png;base64,..."],
  "creadoEn": "2026-06-10T10:30:00.000Z",
  "actualizadoEn": "2026-06-10T10:30:00.000Z"
}
```

---

## 5. Frontend — Angular 19

### 5.1 Módulos y Componentes

#### Componente Principal — `app.ts`

Layout general de la aplicación. Contiene el sidebar de navegación con los módulos:
- **Proyectos** — Vista principal
- **Plantillas** — Gestión de plantillas
- **Técnicos** — Gestión de técnicos

#### Módulo Equipos — `equipos-list.component`

El componente más complejo de la aplicación. Maneja dos vistas:

**Vista 1 — Lista de Proyectos:**
- Cards de proyectos con total de equipos
- Botones de editar, exportar y eliminar (visibles al hover)
- Botón de importar proyecto desde JSON

**Vista 2 — Lista de Equipos del Proyecto:**
- Tres filtros: Pendientes / En proceso / Terminados
- Cards de equipos con estado, progreso y técnico asignado
- Acciones: Revisar, Editar, Eliminar

**Modales:**
- Modal de proyecto (crear/editar)
- Modal de equipo (crear/editar con ítems, guías, técnico y tiempo límite)
- Modal de revisión (checklist interactivo con archivos y observaciones)

#### Módulo Plantillas — `plantillas-list.component`

- Lista de plantillas con sus ítems
- Crear/editar plantillas
- Importar plantillas desde Excel (XLSX)
- Formato Excel: columnas `nombre | descripcion | items` (ítems separados por `|`)

#### Módulo Técnicos — `tecnicos-list.component`

- CRUD de técnicos con nombre y email

#### Módulo Historial — `historial-list.component`

- Vista por proyecto (selección de proyecto)
- Vista de revisiones completadas del proyecto seleccionado
- Solo muestra revisiones con todos los ítems marcados
- Detalle de revisión con ítems, notas, observación general y fotos
- Filtros por estado y búsqueda por equipo/técnico

### 5.2 Modelos de Datos (TypeScript)

```typescript
// Ítem de un equipo (con guía permanente)
interface ItemEquipo {
  label: string;
  observacionGuia: string;    // Instrucciones para el técnico
  archivosGuia: string[];     // Archivos de referencia (base64)
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
  tiempoLimite?: number;
  unidadTiempo?: 'horas' | 'dias';
  iniciadoEn?: string;
  terminadoEn?: string;
  ultimaRevision?: Revision | null;
  totalRevisiones?: number;
  creadoEn: string;
  actualizadoEn: string;
}

// Ítem de una revisión
interface ItemRevision {
  label: string;
  checked: boolean;
  nota: string;               // Observación del técnico al revisar
  archivos: string[];         // Evidencia fotográfica del ítem (base64)
  observacionGuia?: string;   // Hereda del ItemEquipo (solo lectura)
  archivosGuia?: string[];    // Hereda del ItemEquipo (solo lectura)
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
  fotos: string[];            // Fotos generales de la revisión (base64)
  creadoEn: string;
  actualizadoEn: string;
  equipoNombre?: string;
}

// Plantilla
interface Plantilla {
  id: string;
  nombre: string;
  descripcion: string;
  items: string[];
  creadoEn: string;
  actualizadoEn: string;
}

// Técnico
interface Tecnico {
  id: string;
  nombre: string;
  email: string;
  creadoEn: string;
}
```

### 5.3 Servicios

Todos los servicios heredan el patrón básico de llamadas HTTP con `HttpClient` y mapean la respuesta `ApiResponse<T>`:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}
```

| Servicio | Archivo | Responsabilidad |
|----------|---------|-----------------|
| `ProyectosService` | `proyectos.service.ts` | CRUD proyectos, obtener equipos filtrados, exportar/importar |
| `EquiposService` | `equipos.service.ts` | CRUD equipos |
| `PlantillasService` | `plantillas.service.ts` | CRUD plantillas |
| `TecnicosService` | `otros.services.ts` | CRUD técnicos |
| `RevisionesService` | `otros.services.ts` | CRUD revisiones |

### 5.4 Rutas del Frontend

```typescript
const routes = [
  { path: '',          redirectTo: 'equipos', pathMatch: 'full' },
  { path: 'equipos',   loadChildren: () => import('./modules/equipos/equipos.routes') },
  { path: 'historial', loadChildren: () => import('./modules/historial/historial.routes') },
  { path: 'plantillas',loadChildren: () => import('./modules/plantillas/plantillas.routes') },
  { path: 'tecnicos',  loadChildren: () => import('./modules/tecnicos/tecnicos.routes') },
];
```

Todas las rutas usan **lazy loading** para optimizar el tiempo de carga inicial.

---

## 6. Funcionalidades del Sistema

### 6.1 Gestión de Proyectos

Los proyectos son el contenedor principal de la aplicación. Cada proyecto agrupa equipos relacionados.

**Operaciones:**
- Crear proyecto con nombre y descripción opcional
- Editar nombre y descripción
- Eliminar proyecto (el archivo JSON del proyecto también se elimina)
- Exportar proyecto completo como JSON
- Importar proyecto desde un JSON previamente exportado

**Vista de proyectos:** Cards con el nombre, descripción, total de equipos y botones de acción visibles al pasar el mouse.

### 6.2 Gestión de Equipos

Los equipos representan los activos físicos o lógicos que se van a mantener (PCs, servidores, impresoras, etc.).

**Campos del equipo:**
- Nombre (requerido)
- Descripción
- Técnico asignado (selector de técnicos registrados)
- Plantilla de checklist (opcional, aplica ítems predefinidos)
- Tiempo límite (número + unidad: horas o días)
- Ítems del checklist (cada uno con observación guía y archivos guía)

**Ítems del checklist — información de guía:**
Cada ítem puede tener:
- **Observación guía:** Instrucciones permanentes para el técnico (cómo abordar la tarea)
- **Archivos guía:** Imágenes o documentos de referencia (manuales, capturas de pantalla)

Esta información es de solo lectura durante la revisión y sirve como guía para el técnico.

**Filtros de estado:**
Los equipos dentro de un proyecto se clasifican automáticamente en tres estados:

| Estado | Condición |
|--------|-----------|
| Pendiente | Sin revisión o sin ningún ítem marcado |
| En proceso | Al menos 1 ítem marcado, no todos |
| Terminado | Todos los ítems marcados al 100% |

Los equipos terminados desaparecen de Pendientes y En Proceso y solo aparecen en el filtro Terminados.

### 6.3 Sistema de Revisiones

Una revisión es el registro de una sesión de mantenimiento sobre un equipo.

**Flujo de revisión:**
1. El técnico hace clic en **Revisar** en la tarjeta del equipo
2. Se abre el modal de revisión con el checklist del equipo
3. Por cada ítem, el técnico puede:
   - Marcar el ítem como completado (checkbox)
   - Ver la observación guía y archivos de referencia (solo lectura)
   - Agregar una observación propia
   - Adjuntar archivos o imágenes como evidencia
4. El técnico define el estado general: OK / Con observaciones / Con problemas
5. Opcionalmente agrega una observación general y fotos de evidencia
6. Guarda la revisión

**Retomar revisión incompleta:**
Si una revisión se guarda sin completar todos los ítems, al hacer clic en **Revisar** nuevamente se carga el estado anterior (ítems ya marcados, notas, etc.) para continuar donde se dejó.

Al guardar una revisión retomada, la revisión incompleta anterior se elimina y se crea una nueva con el estado actualizado.

### 6.4 Plantillas de Checklist

Las plantillas permiten reutilizar listas de ítems en múltiples equipos.

**Operaciones:**
- Crear plantilla con nombre, descripción e ítems
- Editar plantilla existente (agregar/quitar ítems)
- Eliminar plantilla
- **Importar desde Excel:** Archivo `.xlsx` con columnas `nombre | descripcion | items` donde los ítems se separan con `|`

**Formato Excel para importación:**

| nombre | descripcion | items |
|--------|-------------|-------|
| Mantenimiento PC | Revisión periódica | Revisar antivirus\|Revisar disco\|Verificar RAM |

**Nota:** Al aplicar una plantilla a un equipo, los ítems se copian y pueden modificarse libremente sin afectar la plantilla original.

### 6.5 Gestión de Técnicos

Registro de los técnicos que realizan las revisiones.

**Campos:** Nombre (requerido) y correo electrónico.

Los técnicos pueden ser asignados a equipos (técnico responsable) y seleccionados durante las revisiones (técnico que realizó la revisión).

### 6.6 Historial de Revisiones

El historial muestra únicamente las revisiones **completadas al 100%** (todos los ítems marcados).

**Navegación:**
1. Seleccionar el proyecto
2. Ver la lista de revisiones completas con filtros de texto y estado
3. Hacer clic en **Ver** para ver el detalle completo de la revisión

**Detalle de revisión muestra:**
- Estado general (OK / Observaciones / Problemas)
- Técnico que realizó la revisión
- Lista de ítems con su estado y observaciones
- Archivos adjuntos por ítem (imágenes y documentos)
- Observación general
- Fotos de evidencia

### 6.7 Exportar e Importar Proyectos

Permite hacer copias de seguridad de proyectos y restaurarlos.

**Exportar:**
- Clic en el botón ⬇️ en la tarjeta del proyecto
- Se descarga un archivo `{nombre_proyecto}_techcheck.json`
- El JSON contiene: proyecto, equipos (con sus ítems y guías), revisiones y técnicos

**Importar:**
- Clic en **Importar proyecto** en la vista de proyectos
- Seleccionar el archivo JSON exportado previamente
- Se crea un nuevo proyecto con nuevos IDs
- Los técnicos nuevos se agregan al sistema si no existen (verificado por email)

**Estructura del JSON exportado:**
```json
{
  "proyecto": { "nombre": "...", "descripcion": "..." },
  "equipos": [...],
  "revisiones": [...],
  "tecnicos": [...]
}
```

---

## 7. API REST — Referencia Completa

### Formato de Respuesta

Todas las respuestas siguen el mismo formato:

```json
{
  "success": true | false,
  "data": { ... } | [...],
  "message": "Mensaje de error (solo en errores)"
}
```

### Códigos de Estado HTTP

| Código | Uso |
|--------|-----|
| `200` | Operación exitosa |
| `201` | Recurso creado exitosamente |
| `400` | Error de validación (datos incorrectos) |
| `404` | Recurso no encontrado |
| `500` | Error interno del servidor |

### Ejemplos de Llamadas

#### Crear un equipo
```http
POST /api/equipos
Content-Type: application/json

{
  "nombre": "PC-Recepcion",
  "descripcion": "Dell OptiPlex 7090",
  "items": [
    {
      "label": "Verificar antivirus",
      "observacionGuia": "Abrir Avast y verificar version",
      "archivosGuia": []
    }
  ],
  "proyectoIds": ["uuid-del-proyecto"],
  "tecnicoAsignadoId": "uuid-del-tecnico",
  "tiempoLimite": 2,
  "unidadTiempo": "horas"
}
```

#### Crear una revisión
```http
POST /api/revisiones
Content-Type: application/json

{
  "equipoId": "uuid-del-equipo",
  "tecnicoId": "uuid-del-tecnico",
  "estado": "ok",
  "items": [
    {
      "label": "Verificar antivirus",
      "checked": true,
      "nota": "Actualizado correctamente",
      "archivos": []
    }
  ],
  "observacionGeneral": "Equipo en buen estado",
  "fotos": []
}
```

#### Obtener equipos de un proyecto filtrados
```http
GET /api/proyectos/{id}/equipos?estado=en_proceso
```

---

## 8. Flujo de Datos

### Ciclo de vida de un mantenimiento

```
1. CREAR PROYECTO
   └── Nombre + descripción
       └── Se crea archivo data/proyectos/{id}.json vacío

2. AGREGAR EQUIPO AL PROYECTO
   └── Nombre, ítems, técnico, tiempo límite
       └── Se guarda en data/proyectos/{proyectoId}.json → equipos[]

3. REALIZAR REVISIÓN
   └── Técnico abre modal de revisión
   └── Marca ítems, agrega notas y archivos
   └── Guarda → se crea en data/proyectos/{proyectoId}.json → revisiones[]
   └── Si retoma revisión incompleta → elimina la anterior, crea nueva

4. FILTRADO AUTOMÁTICO
   └── Pendiente: sin revisión o 0 ítems marcados
   └── En proceso: 1+ ítems marcados, no todos
   └── Terminado: todos los ítems marcados

5. HISTORIAL
   └── Solo revisiones con 100% de ítems marcados
   └── Organizadas por proyecto
```

### Flujo de importación de plantillas Excel

```
Excel (.xlsx)
  └── Librería XLSX (CDN)
      └── Parsear hoja 1
          └── Fila por fila (saltar header)
              └── Columna 0: nombre
              └── Columna 1: descripcion  
              └── Columna 2: items separados por "|"
                  └── POST /api/plantillas por cada plantilla válida
                      └── Mensaje de éxito con cantidad importada
```

---

## 9. Instalación y Despliegue

### Requisitos

- Node.js 18 o superior
- npm 9 o superior
- Windows 10/11 (o cualquier OS con Node.js)

### Instalación del Backend

```bash
cd techcheck/backend
npm install
```

### Compilar el Frontend

```bash
cd techcheck/frontend
npm install
npx ng build --configuration=production
```

### Iniciar la Aplicación

**Opción 1 — Script automático (Windows):**
```
Doble clic en start.bat
```

**Opción 2 — Manual:**
```bash
cd techcheck/backend
node index.js
```

Luego abrir: `http://localhost:3000` (o el puerto configurado en `.env`)

### Limpiar caché de Angular (si hay problemas de compilación)

```bash
cd techcheck/frontend
npx ng cache clean
npx ng build --configuration=production
```

---

## 10. Variables de Entorno

| Variable | Valor por defecto | Descripción |
|----------|------------------|-------------|
| `PORT` | `3000` | Puerto del servidor Express |
| `DATA_SOURCE` | `json` | Fuente de datos (`json` o `postgres` en el futuro) |
| `DB_HOST` | `localhost` | Host de la base de datos (futuro) |
| `DB_PORT` | `5432` | Puerto de PostgreSQL (futuro) |
| `DB_NAME` | `techcheck` | Nombre de la base de datos (futuro) |
| `DB_USER` | `postgres` | Usuario de la base de datos (futuro) |
| `DB_PASSWORD` | *(vacío)* | Contraseña de la base de datos (futuro) |
| `JWT_SECRET` | `techcheck_secret_key` | Clave para tokens JWT (futuro) |
| `JWT_EXPIRES_IN` | `8h` | Expiración de tokens JWT (futuro) |
| `APP_NAME` | `TechCheck` | Nombre de la aplicación |
| `APP_VERSION` | `1.0.0` | Versión actual |
| `NODE_ENV` | `development` | Entorno (`development` o `production`) |

---

## 11. Guía de Uso

### Primer uso — Configuración inicial

1. Crear los técnicos que usará el sistema (menú **Técnicos**)
2. Crear plantillas de checklist reutilizables (menú **Plantillas**)
   - O importar plantillas desde Excel
3. Crear el primer proyecto (botón **+ Nuevo proyecto**)
4. Dentro del proyecto, crear los equipos
   - Asignar un técnico responsable
   - Aplicar una plantilla o agregar ítems manualmente
   - Opcionalmente agregar observaciones guía e imágenes de referencia por ítem

### Realizar una revisión

1. Entrar al proyecto correspondiente
2. En la pestaña **Pendientes**, localizar el equipo a revisar
3. Clic en **Revisar**
4. Verificar cada ítem del checklist:
   - Marcar como completado
   - Ver la guía del ítem si existe
   - Agregar observaciones y archivos de evidencia
5. Definir el estado general y agregar observación general si aplica
6. Clic en **Guardar revisión**

### Consultar el historial

1. Ir al menú **Historial** (si está habilitado) o ver en la pestaña **Terminados** del proyecto
2. Las revisiones completadas al 100% aparecen en la pestaña **Terminados**
3. Clic en **Ver** para ver el detalle completo

### Hacer copia de seguridad de un proyecto

1. En la vista de proyectos, pasar el mouse sobre el proyecto
2. Clic en el botón ⬇️ (exportar)
3. Se descarga el archivo JSON con todos los datos del proyecto

### Restaurar un proyecto

1. En la vista de proyectos, clic en **Importar proyecto**
2. Seleccionar el archivo JSON exportado previamente
3. El proyecto se crea con todos sus equipos y revisiones

---

## 12. Hoja de Ruta (Roadmap)

Las siguientes funcionalidades están planificadas para futuras versiones:

### Corto plazo
- [ ] Temporizador en vivo con alerta de tiempo excedido por equipo
- [ ] Notificaciones cuando un equipo excede su tiempo límite

### Mediano plazo
- [ ] Migración a PostgreSQL (infraestructura preparada en `dataAccess.js` y `.env`)
- [ ] Sistema de autenticación con JWT (infraestructura preparada en `.env`)
- [ ] Dashboard con estadísticas de mantenimiento
- [ ] Exportar reportes en PDF

### Largo plazo
- [ ] Aplicación móvil (PWA)
- [ ] Notificaciones por correo electrónico
- [ ] Multi-empresa / multi-tenant
- [ ] Integración con sistemas ERP

---

*Documentación generada — TechCheck v1.0.0 — Junio 2026*
