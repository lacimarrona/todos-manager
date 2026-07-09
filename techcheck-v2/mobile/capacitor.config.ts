import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.techcheck.app',
  appName: 'TechCheck',
  webDir: 'www/browser',
  server: {
    androidScheme: 'https',
    cleartext: true,   // permite HTTP al backend LAN; network_security_config.xml restringe a IPs locales
  },
  plugins: {
    Camera: {
      // Permissions are handled by the plugin automatically
    },
  },
};

export default config;
