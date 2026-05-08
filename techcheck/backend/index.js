require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/proyectos',  require('./routes/proyectos'));
app.use('/api/equipos',    require('./routes/equipos'));
app.use('/api/plantillas', require('./routes/plantillas'));
app.use('/api/tecnicos',   require('./routes/tecnicos'));
app.use('/api/revisiones', require('./routes/revisiones'));

app.get('/api/health', (req, res) => {
  res.json({ success: true, mensaje: 'TechCheck API funcionando', version: '1.0.0' });
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
  console.log(`TechCheck corriendo en http://localhost:${PORT}`);
});