require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

// Migrar datos JSON → SQLite si la DB está vacía
const { migrar } = require('./db/migrate');
migrar();

// Iniciar cron de tareas programadas
const { iniciarCron } = require('./jobs/tareas-cron');
iniciarCron();

const app = express();

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const APP_NAME = process.env.APP_NAME || 'TechCheck';
const APP_VERSION = process.env.APP_VERSION || '1.0.0';

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const auth  = require('./middleware/auth');
const roles = require('./middleware/roles');

// Ruta pública
app.use('/api/auth', require('./routes/auth'));

// Todas las demás rutas requieren autenticación
app.use('/api/usuarios',   require('./routes/usuarios'));          // tiene auth+roles internamente
app.use('/api/proyectos',  auth, require('./routes/proyectos'));   // control de roles interno por endpoint
app.use('/api/equipos',    auth, require('./routes/equipos'));
app.use('/api/plantillas', auth, roles('admin', 'project_admin', 'tecnico'), require('./routes/plantillas'));
app.use('/api/tecnicos',   auth, roles('admin', 'project_admin'), require('./routes/tecnicos'));
app.use('/api/revisiones', auth, require('./routes/revisiones'));
app.use('/api/archivos',   auth, require('./routes/archivos'));
app.use('/api/tareas',     auth, require('./routes/tareas'));
app.use('/api/dashboard',  auth, roles('admin'), require('./routes/dashboard'));
app.use('/api/exportar',   auth, roles('admin'), require('./routes/exportar'));
app.use('/api/catalogos',  auth, roles('admin'), require('./routes/catalogos'));

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    app: APP_NAME,
    version: APP_VERSION,
    entorno: NODE_ENV,
    dataSource: process.env.DATA_SOURCE || 'json',
    mensaje: `${APP_NAME} API funcionando`
  });
});

const frontendPath = path.join(__dirname, '../frontend/dist/frontend/browser');
app.use(express.static(frontendPath));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'Ruta no encontrada' });
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  ${APP_NAME} v${APP_VERSION}`);
  console.log(`  Entorno : ${NODE_ENV}`);
  console.log(`  Puerto  : ${PORT}`);
  console.log(`  Datos   : ${process.env.DATA_SOURCE || 'json'}`);
  console.log(`  URL     : http://localhost:${PORT}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
});