require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── MIDDLEWARES ────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' })); // 10mb para soportar fotos en base64
app.use(express.urlencoded({ extended: true }));

// ─── RUTAS API ──────────────────────────────────────────────
app.use('/api/equipos',    require('./routes/equipos'));
app.use('/api/plantillas', require('./routes/plantillas'));
app.use('/api/tecnicos',   require('./routes/tecnicos'));
app.use('/api/revisiones', require('./routes/revisiones'));

// ─── HEALTH CHECK ───────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    mensaje: 'TechCheck API funcionando',
    version: '1.0.0',
    dataSource: process.env.DATA_SOURCE || 'json',
    timestamp: new Date().toISOString()
  });
});

// ─── SERVIR FRONTEND (Angular build) ────────────────────────
const frontendPath = path.join(__dirname, '../frontend/dist/frontend/browser');
app.use(express.static(frontendPath));

// Todas las rutas no-API retornan el index.html (SPA routing)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'Ruta no encontrada' });
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ─── INICIAR SERVIDOR ────────────────────────────────────────
app.listen(PORT, () => {
  console.log('╔══════════════════════════════════════╗');
  console.log('║         TechCheck v1.0.0             ║');
  console.log('╠══════════════════════════════════════╣');
  console.log(`║  API:  http://localhost:${PORT}/api     ║`);
  console.log(`║  App:  http://localhost:${PORT}         ║`);
  console.log(`║  Data: ${process.env.DATA_SOURCE || 'json (local)'}                   ║`);
  console.log('╚══════════════════════════════════════╝');
});
