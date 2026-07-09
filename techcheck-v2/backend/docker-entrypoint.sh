#!/bin/sh
set -e

echo "======================================"
echo "  TechCheck v2 — Iniciando backend"
echo "======================================"

echo "[1/2] Ejecutando migraciones de base de datos..."
npx sequelize-cli db:migrate
echo "[1/2] Migraciones completadas."

echo "[2/2] Iniciando servidor Node.js..."
exec node src/index.js
