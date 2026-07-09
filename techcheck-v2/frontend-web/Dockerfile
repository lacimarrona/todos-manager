# ── Etapa 1: Build Angular ────────────────────────────────────────────────────
FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build -- --configuration production

# ── Etapa 2: Servidor nginx ───────────────────────────────────────────────────
FROM nginx:1.28-alpine

# Eliminar config default de nginx
RUN rm /etc/nginx/conf.d/default.conf

# Quitar la directiva 'user nginx;' del nginx.conf principal — no es necesaria
# cuando nginx inicia ya como usuario no-root
RUN sed -i '/^user /d' /etc/nginx/nginx.conf

# Copiar config personalizada
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Angular 17+ genera los archivos en dist/<nombre>/browser/
COPY --from=builder /app/dist/techcheck-frontend/browser /usr/share/nginx/html

# Otorgar permisos al usuario nginx sobre los directorios que necesita escribir
RUN chown -R nginx:nginx \
        /usr/share/nginx/html \
        /var/cache/nginx \
        /var/log/nginx \
        /etc/nginx/conf.d \
    && touch /var/run/nginx.pid \
    && chown nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
