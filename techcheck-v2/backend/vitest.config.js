const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    testTimeout: 10000,
    hookTimeout: 10000,
    // Los tests de integración comparten la misma BD de test (se truncan entre
    // tests); correrlos en paralelo entre archivos pisaría datos entre sí.
    fileParallelism: false,
  },
});
