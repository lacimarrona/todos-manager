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
`);

module.exports = db;
