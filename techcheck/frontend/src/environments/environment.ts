export const environment = {
  production: false,
  // Ruta relativa: en dev la resuelve el proxy (proxy.conf.json) hacia el
  // backend; en prod el backend sirve el frontend desde el mismo origen.
  apiUrl: '/api'
};