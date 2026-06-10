require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const APP_NAME = process.env.APP_NAME || 'TechCheck';
const APP_VERSION = process.env.APP_VERSION || '1.0.0';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api/proyectos',  require('./routes/proyectos'));
app.use('/api/equipos',    require('./routes/equipos'));
app.use('/api/plantillas', require('./routes/plantillas'));
app.use('/api/tecnicos',   require('./routes/tecnicos'));
app.use('/api/revisiones', require('./routes/revisiones'));

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