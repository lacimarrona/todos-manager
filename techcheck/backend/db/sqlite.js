const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '../data');
const DB_PATH = path.join(DB_DIR, 'techcheck.db');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);

db.exec(`PRAGMA journal_mode = WAL`);
db.exec(`PRAGMA foreign_keys = ON`);

db.exec(`
  CREATE TABLE IF NOT EXISTS proyectos (
    id             TEXT PRIMARY KEY,
    nombre         TEXT NOT NULL,
    descripcion    TEXT NOT NULL DEFAULT '',
    creado_en      TEXT NOT NULL,
    actualizado_en TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tecnicos (
    id        TEXT PRIMARY KEY,
    nombre    TEXT NOT NULL,
    email     TEXT NOT NULL DEFAULT '',
    creado_en TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS usuarios (
    id            TEXT PRIMARY KEY,
    nombre        TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL DEFAULT '',
    rol           TEXT NOT NULL DEFAULT 'tecnico',
    activo        INTEGER NOT NULL DEFAULT 1,
    creado_en     TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          TEXT PRIMARY KEY,
    usuario_id  TEXT NOT NULL,
    token_hash  TEXT NOT NULL UNIQUE,
    expires_at  TEXT NOT NULL,
    creado_en   TEXT NOT NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS plantillas (
    id             TEXT PRIMARY KEY,
    nombre         TEXT NOT NULL,
    descripcion    TEXT NOT NULL DEFAULT '',
    items          TEXT NOT NULL DEFAULT '[]',
    creado_en      TEXT NOT NULL,
    actualizado_en TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS equipos (
    id                   TEXT PRIMARY KEY,
    nombre               TEXT NOT NULL,
    descripcion          TEXT NOT NULL DEFAULT '',
    items                TEXT NOT NULL DEFAULT '[]',
    proyecto_id          TEXT NOT NULL,
    plantilla_id         TEXT,
    tecnico_asignado_id  TEXT,
    archivado            INTEGER NOT NULL DEFAULT 0,
    creado_en            TEXT NOT NULL,
    actualizado_en       TEXT NOT NULL,
    FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS revisiones (
    id                  TEXT PRIMARY KEY,
    equipo_id           TEXT NOT NULL,
    tecnico_id          TEXT,
    tecnico_nombre      TEXT NOT NULL DEFAULT '',
    estado              TEXT NOT NULL,
    items               TEXT NOT NULL DEFAULT '[]',
    observacion_general TEXT NOT NULL DEFAULT '',
    fotos               TEXT NOT NULL DEFAULT '[]',
    creado_en           TEXT NOT NULL,
    actualizado_en      TEXT NOT NULL,
    FOREIGN KEY (equipo_id) REFERENCES equipos(id)
  );

  CREATE TABLE IF NOT EXISTS tareas_programadas (
    id          TEXT PRIMARY KEY,
    equipo_id   TEXT NOT NULL,
    tecnico_id  TEXT,
    hora        TEXT NOT NULL,
    dias_semana TEXT NOT NULL DEFAULT '[]',
    activa      INTEGER NOT NULL DEFAULT 1,
    fecha_fin   TEXT,
    creado_en   TEXT NOT NULL,
    FOREIGN KEY (equipo_id) REFERENCES equipos(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS proyecto_permisos (
    proyecto_id TEXT NOT NULL,
    tecnico_id  TEXT NOT NULL,
    nivel       TEXT NOT NULL DEFAULT 'ver',
    PRIMARY KEY (proyecto_id, tecnico_id),
    FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS proyecto_asignaciones (
    proyecto_id TEXT NOT NULL,
    usuario_id  TEXT NOT NULL,
    PRIMARY KEY (proyecto_id, usuario_id),
    FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id)  REFERENCES usuarios(id)  ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tecnico_supervisores (
    tecnico_id    TEXT NOT NULL,
    supervisor_id TEXT NOT NULL,
    PRIMARY KEY (tecnico_id, supervisor_id),
    FOREIGN KEY (tecnico_id)    REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (supervisor_id) REFERENCES usuarios(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS plantilla_proyectos (
    plantilla_id TEXT NOT NULL,
    proyecto_id  TEXT NOT NULL,
    PRIMARY KEY (plantilla_id, proyecto_id),
    FOREIGN KEY (plantilla_id) REFERENCES plantillas(id) ON DELETE CASCADE,
    FOREIGN KEY (proyecto_id)  REFERENCES proyectos(id)  ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS grupos_elemento (
    id          TEXT PRIMARY KEY,
    nombre      TEXT NOT NULL,
    descripcion TEXT NOT NULL DEFAULT '',
    activo      INTEGER NOT NULL DEFAULT 1,
    creado_en   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS elementos_grupo (
    id          TEXT PRIMARY KEY,
    grupo_id    TEXT NOT NULL,
    valor       TEXT NOT NULL,
    descripcion TEXT NOT NULL DEFAULT '',
    activo      INTEGER NOT NULL DEFAULT 1,
    creado_en   TEXT NOT NULL,
    FOREIGN KEY (grupo_id) REFERENCES grupos_elemento(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS usuario_permisos (
    usuario_id TEXT NOT NULL,
    permiso    TEXT NOT NULL,
    PRIMARY KEY (usuario_id, permiso),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
  );
`);

// Registro de tareas programadas que no se ejecutaron (servidor apagado u otra causa)
db.exec(`
  CREATE TABLE IF NOT EXISTS tareas_no_cumplidas (
    id             TEXT PRIMARY KEY,
    tarea_id       TEXT NOT NULL,
    equipo_id      TEXT NOT NULL,
    equipo_nombre  TEXT NOT NULL DEFAULT '',
    proyecto_id    TEXT NOT NULL DEFAULT '',
    fecha          TEXT NOT NULL,
    hora           TEXT NOT NULL,
    tecnico_id     TEXT,
    tecnico_nombre TEXT NOT NULL DEFAULT '',
    registrado_en  TEXT NOT NULL,
    UNIQUE(tarea_id, fecha)
  );
`);

// Tabla de asociación catálogo ↔ proyecto (como plantilla_proyectos)
db.exec(`
  CREATE TABLE IF NOT EXISTS catalogo_proyectos (
    catalogo_id TEXT NOT NULL,
    proyecto_id TEXT NOT NULL,
    PRIMARY KEY (catalogo_id, proyecto_id),
    FOREIGN KEY (catalogo_id) REFERENCES grupos_elemento(id) ON DELETE CASCADE,
    FOREIGN KEY (proyecto_id) REFERENCES proyectos(id)  ON DELETE CASCADE
  );
`);

// Columnas nuevas en tareas_programadas (unificación de tareas)
try { db.exec("ALTER TABLE tareas_programadas ADD COLUMN tipo TEXT NOT NULL DEFAULT 'recurrente'"); } catch {}
try { db.exec('ALTER TABLE tareas_programadas ADD COLUMN fecha_especifica TEXT'); } catch {}
try { db.exec('ALTER TABLE tareas_programadas ADD COLUMN fecha_inicio TEXT'); } catch {}

// Agregar columna restringido a proyectos si no existe (migración incremental)
try { db.exec('ALTER TABLE proyectos ADD COLUMN restringido INTEGER NOT NULL DEFAULT 0'); } catch {}
// Agregar creado_por a plantillas (quién la creó, para control de acceso por rol)
try { db.exec('ALTER TABLE plantillas ADD COLUMN creado_por TEXT'); } catch {}
// Migración: username como campo de inicio de sesión (reemplaza email)
try { db.exec('ALTER TABLE usuarios ADD COLUMN username TEXT'); } catch {}
db.exec(`UPDATE usuarios SET username = email WHERE username IS NULL OR username = ''`);
// Asignar usernames únicos a técnicos sin email (usando su id como fallback)
db.prepare("UPDATE usuarios SET username = 'tecnico_' || substr(id, 1, 8) WHERE username IS NULL OR username = ''").run();
try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_username ON usuarios(username)'); } catch {}

// Migrar técnicos existentes → usuarios con rol 'tecnico' (solo si usuarios está vacía)
const countUsuarios = db.prepare('SELECT COUNT(*) as c FROM usuarios').get();
if (countUsuarios.c === 0) {
  const tecnicos = db.prepare('SELECT * FROM tecnicos').all();
  const insertUsuario = db.prepare(
    'INSERT OR IGNORE INTO usuarios (id, nombre, email, password_hash, rol, activo, creado_en) VALUES (?,?,?,?,?,?,?)'
  );
  for (const t of tecnicos) {
    insertUsuario.run(t.id, t.nombre, t.email || '', '', 'tecnico', 1, t.creado_en);
  }
}

module.exports = db;
