// Se usa ngrok en vez de una IP LAN porque el dispositivo de prueba cambia de red
// (PC de la empresa, PC de casa, etc). Las URLs de ngrok free ROTAN cada vez que se
// reinicia el tunel: si el login deja de funcionar en el celular, lo primero a revisar
// es si esta URL sigue siendo la vigente en `ngrok http 4000`.
// Alternativas si hace falta un IP fijo puntual:
//   - Emulador Android: apiUrl: 'http://10.0.2.2:4000/api'
//   - Dispositivo fisico en la misma Wi-Fi que el backend: apiUrl: 'http://<IP-LAN-PC>:4000/api'
export const environment = {
  production: false,
  apiUrl: 'https://naming-mandolin-haven.ngrok-free.dev/api',
};
