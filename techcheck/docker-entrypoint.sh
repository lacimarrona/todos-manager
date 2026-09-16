#!/bin/sh
set -e

DATA_DIR="./data"
DB_FILE="$DATA_DIR/techcheck.db"

# Crear estructura de directorios si no existe
mkdir -p "$DATA_DIR/archivos"

# Informar si es la primera vez (volumen vacío)
if [ ! -f "$DB_FILE" ]; then
  echo ""
  echo "============================================================"
  echo "  TechCheck — Base de datos no encontrada en el volumen."
  echo "  Se creará una nueva base de datos vacía."
  echo ""
  echo "  Si deseas migrar datos existentes, ejecuta:"
  echo "  docker cp ./backend/data/techcheck.db techcheck:/app/backend/data/techcheck.db"
  echo "  y luego reinicia el contenedor."
  echo "============================================================"
  echo ""
fi

echo "Iniciando TechCheck v${APP_VERSION:-1.5.0} en el puerto ${PORT:-3010} (entorno: ${NODE_ENV:-production})"

exec node index.js
