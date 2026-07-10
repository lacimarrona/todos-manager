// Decision (2026-07-10): se mantiene ngrok tambien en build de produccion porque
// el NAS todavia no tiene dominio/DDNS con HTTPS expuesto hacia afuera.
// IMPORTANTE: esta URL rota cada vez que se reinicia el tunel de ngrok. Antes de
// publicar un APK/AAB nuevo hay que confirmar que coincide con la sesion activa de
// `ngrok http 4000` (o mejor, usar un dominio reservado de ngrok si se paga el plan).
// Cuando el NAS tenga DDNS/HTTPS propio, reemplazar por ese dominio fijo.
export const environment = {
  production: true,
  apiUrl: 'https://naming-mandolin-haven.ngrok-free.dev/api',
};
