require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { sequelize } = require('./config/database');
require('./models'); // registra modelos y asociaciones

const authRoutes    = require('./routes/auth.routes');
const adminRoutes   = require('./routes/admin.routes');
const usuarioRoutes = require('./routes/usuario.routes');
const proyectoRoutes   = require('./routes/proyecto.routes');
const equipoRoutes     = require('./routes/equipo.routes');
const revisionRoutes   = require('./routes/revision.routes');
const plantillaRoutes  = require('./routes/plantilla.routes');
const tareaRoutes      = require('./routes/tarea.routes');
const tecnicoRoutes    = require('./routes/tecnico.routes');

const app = express();

// ── Trust proxy: solo en producción (detrás de nginx) ────────────────────────
// En dev el puerto 4000 está expuesto directamente; activarlo permitiría
// falsificar X-Forwarded-For para bypassear el rate limiter.
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// ── Rate limiter en memoria (login + refresh) ─────────────────────────────────
const authAttempts = new Map();
function makeRateLimiter(max, windowMs) {
  return function rateLimiter(req, res, next) {
    const ip = req.ip || 'unknown';
    const key = `${req.originalUrl}:${ip}`;
    const now = Date.now();
    const entry = authAttempts.get(key);
    if (!entry || now > entry.resetAt) {
      authAttempts.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({ error: `Demasiados intentos. Espera ${Math.ceil(retryAfter / 60)} minuto(s).` });
    }
    next();
  };
}
const authRateLimiter = makeRateLimiter(20, 15 * 60 * 1000);

// Limpiar entradas expiradas cada hora para evitar crecimiento ilimitado del Map.
// .unref() evita que este timer mantenga el proceso vivo (necesario para que los
// tests con Vitest/Supertest terminen solos al acabar, sin colgarse).
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of authAttempts.entries()) {
    if (now > entry.resetAt) authAttempts.delete(key);
  }
}, 60 * 60 * 1000).unref();

app.use(helmet({ contentSecurityPolicy: false }));

// CORS: orígenes explícitos si CORS_ORIGIN está definido; en caso contrario solo localhost (dev/LAN)
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : null;

// Capacitor (Android: https://localhost, iOS: capacitor://localhost) siempre permitido
const CAPACITOR_ORIGINS = new Set(['https://localhost', 'capacitor://localhost']);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (CAPACITOR_ORIGINS.has(origin)) return callback(null, true);
    if (!allowedOrigins) return callback(null, true); // modo dev: sin restricción
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`Origen CORS no permitido: ${origin}`));
  },
  credentials: true,
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
// Límite global reducido; los endpoints de archivos e importación definen el suyo propio
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Aplicar rate limiter a los endpoints de autenticación (login y refresh)
app.use('/api/auth/login',   authRateLimiter);
app.use('/api/auth/refresh', authRateLimiter);
app.use('/api/auth',      authRoutes);
app.use('/api/admin',     adminRoutes);
app.use('/api/usuarios',  usuarioRoutes);
app.use('/api/proyectos',   proyectoRoutes);
app.use('/api/equipos',     equipoRoutes);
app.use('/api/revisiones',  revisionRoutes);
app.use('/api/plantillas',         plantillaRoutes);
app.use('/api/tareas-programadas', tareaRoutes);
app.use('/api/tecnicos',           tecnicoRoutes);

app.get('/api/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ status: 'ok', db: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// ── Middleware global de errores ──────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error('[global-error]', err);
  if (res.headersSent) return;
  const isProd = process.env.NODE_ENV === 'production';
  // En producción los errores 5xx usan mensaje genérico para no filtrar
  // detalles de la BD (nombres de tablas, constraints de Sequelize, etc.)
  const clientMsg = (isProd && (!err.status || err.status >= 500))
    ? 'Error interno del servidor'
    : (err.message || 'Error interno del servidor');
  res.status(err.status || 500).json({ error: clientMsg });
});

module.exports = app;
