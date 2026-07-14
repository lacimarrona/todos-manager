import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.techcheck.app',
  appName: 'TechCheck',
  webDir: 'www/browser',
  server: {
    androidScheme: 'https',
    // cleartext desactivado — la app usa HTTPS (ngrok / dominio propio).
    // network_security_config.xml permite HTTP solo a emulador y localhost para debugging puntual.
  },
  plugins: {
    Camera: {
      // Permissions are handled by the plugin automatically
    },
  },
};

export default config;
