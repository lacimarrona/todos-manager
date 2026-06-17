#!/bin/sh
set -e

# Asegurar que exista el directorio de datos (se monta como volumen)
mkdir -p ./data/proyectos

echo "Iniciando TechCheck en el puerto ${PORT:-3010} (entorno: ${NODE_ENV:-production})"

# Arrancar el backend (sirve también el frontend compilado)
exec node index.js
