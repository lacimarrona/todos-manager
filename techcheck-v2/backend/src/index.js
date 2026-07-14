const app = require('./app');
const { sequelize } = require('./config/database');

const PORT  = process.env.PORT || 4000;
const isProd = process.env.NODE_ENV === 'production';
const log   = (...args) => { if (!isProd) console.log(...args); };

async function start() {
  try {
    await sequelize.authenticate();
    log('MySQL conectado correctamente.');
    const { iniciarCron } = require('./jobs/tareas-cron');
    iniciarCron();
    app.listen(PORT, () => {
      log(`[TechCheck v2] Servidor en puerto ${PORT} — NODE_ENV=${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('Error al conectar a la base de datos:', error.message);
    process.exit(1);
  }
}

start();
