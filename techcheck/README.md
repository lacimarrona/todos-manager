# TechCheck v1.0.0
Sistema de checklists de mantenimiento técnico

## Requisitos
- Node.js 18 o superior (https://nodejs.org)
- Windows 10/11

## Cómo ejecutar
1. Doble clic en `start.bat`
2. La aplicación abre automáticamente en http://localhost:3000

## Estructura del proyecto
```
techcheck/
├── start.bat                    ← Ejecutable principal
├── backend/
│   ├── index.js                 ← Servidor Express
│   ├── .env                     ← Configuración (puerto, BD futura)
│   ├── routes/                  ← Un archivo por módulo
│   │   ├── equipos.js
│   │   ├── plantillas.js
│   │   ├── tecnicos.js
│   │   └── revisiones.js
│   ├── db/
│   │   └── dataAccess.js        ← Capa de datos (JSON hoy, BD mañana)
│   └── data/
│       └── db.json              ← Base de datos JSON
└── frontend/
    └── dist/frontend/           ← App Angular compilada
```

## Migración futura a base de datos
1. Instalar PostgreSQL
2. Crear base de datos `techcheck`
3. Editar `backend/.env`:
   - Cambiar `DATA_SOURCE=database`
   - Completar `DATABASE_URL=postgresql://...`
4. Implementar `backend/db/dataAccess.db.js` con las mismas funciones
5. Cambiar el `require` en cada route de `dataAccess.js` a `dataAccess.db.js`

No se toca el frontend ni las rutas. Solo la capa de datos.

## Puerto
Por defecto: 3000
Para cambiarlo, editar `backend/.env` → `PORT=XXXX`
