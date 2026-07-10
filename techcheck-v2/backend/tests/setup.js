// Se ejecuta antes que cualquier archivo de test. Carga .env.test con override
// para que gane por encima de cualquier require('dotenv').config() posterior
// (config/database.js, config/sequelize.js, app.js) que por defecto NO pisa
// variables ya seteadas.
require('dotenv').config({ path: '.env.test', override: true });

if (!process.env.DB_NAME || !process.env.DB_NAME.includes('test')) {
  throw new Error(
    `DB_NAME ("${process.env.DB_NAME}") no parece una base de datos de test. ` +
    'Verificá backend/.env.test antes de correr los tests (ver .env.test.example).'
  );
}
