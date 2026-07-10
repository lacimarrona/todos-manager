const app = require('./app');
const { sequelize } = require('./config/database');

const PORT = process.env.PORT || 4000;

async function start() {
  try {
    await sequelize.authenticate();
    console.log('MySQL conectado correctamente.');
    const { iniciarCron } = require('./jobs/tareas-cron');
    iniciarCron();
    app.listen(PORT, () => {
      console.log(`[TechCheck v2] Servidor en puerto ${PORT} — NODE_ENV=${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('Error al conectar a la base de datos:', error.message);
    process.exit(1);
  }
}

start();
