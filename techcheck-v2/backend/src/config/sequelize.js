require('dotenv').config();

const fs = require('fs');

const baseDialectOptions = { charset: 'utf8mb4' };
const baseDefine = { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' };

function buildSslConfig() {
  if (process.env.DB_SSL !== 'true') return false;
  const caPath = process.env.DB_SSL_CA;
  if (caPath) return { rejectUnauthorized: true, ca: fs.readFileSync(caPath) };
  // SSL sin CA solo en redes internas de confianza (ej. Docker bridge)
  return { rejectUnauthorized: true };
}

module.exports = {
  development: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    dialect: 'mysql',
    dialectOptions: baseDialectOptions,
    define: baseDefine,
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    dialect: 'mysql',
    logging: false,
    dialectOptions: {
      ...baseDialectOptions,
      ssl: buildSslConfig(),
    },
    define: baseDefine,
  },
};
