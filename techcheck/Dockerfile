# ── Etapa 1: Compilar el frontend ────────────────────────────
FROM node:22-alpine AS build-frontend

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npx ng build --configuration=production

# ── Etapa 2: Servidor de producción ──────────────────────────
FROM node:22-alpine AS production

WORKDIR /app/backend

# Sin dependencias nativas: node:sqlite viene integrado en Node 22+
COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/ ./

COPY --from=build-frontend /app/frontend/dist/frontend/browser ./public

RUN sed -i "s|../frontend/dist/frontend/browser|./public|g" index.js

RUN mkdir -p ./data/proyectos

EXPOSE 3010

ENV PORT=3010
ENV NODE_ENV=production
ENV DATA_SOURCE=sqlite
ENV APP_NAME=TechCheck
ENV APP_VERSION=1.0.0

COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

WORKDIR /app/backend
ENTRYPOINT ["/app/docker-entrypoint.sh"]
