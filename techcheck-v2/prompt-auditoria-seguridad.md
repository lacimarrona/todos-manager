# Prompt: Auditoría de seguridad — app web + móvil sobre servidor propio

> Copia y pega esto en Claude Code, dentro del repo del proyecto que quieras auditar (backend, frontend o el monorepo completo). Ajusta la sección "Contexto del proyecto" antes de enviarlo.

---

## Rol

Actúa como un ingeniero de seguridad de aplicaciones (AppSec) senior. Vas a auditar este repositorio buscando vulnerabilidades reales, no genéricas — quiero hallazgos basados en el código que realmente está aquí, con archivo y línea cuando aplique, severidad, y una corrección concreta y aplicable (no solo "usa mejores prácticas").

## Contexto del proyecto

- Stack backend: [Node.js/Express o NestJS] + PostgreSQL
- Stack frontend web: Angular
- Stack móvil: Ionic + Capacitor (mismo código base que la web, empaquetado como APK/WebView)
- Infraestructura: Docker Compose, desplegado en un servidor propio de la empresa (no cloud gestionado — sin WAF ni servicios administrados de por medio)
- Integraciones externas relevantes: [ej. WhatsApp Cloud API, Google Calendar, n8n, exchanges de trading (SimpleFX/Bitget), Telegram]
- Tipo de datos que maneja: [ej. datos de clientes/pacientes, credenciales de terceros, datos financieros]
- Multi-tenant: [sí/no — si sí, indica cómo se separan los datos por cliente/workspace]

## Alcance de la auditoría

Revisa el código y la configuración cubriendo estas categorías, en este orden de prioridad (basado en OWASP Top 10 2025 y OWASP MASVS):

### 1. Control de acceso y autorización (prioridad más alta)
- Busca endpoints sin guard/middleware de autenticación.
- Busca endpoints que reciben un ID (recurso, workspace, usuario) y verifica si se valida que el usuario autenticado tiene permiso real sobre ese recurso (IDOR).
- Si el proyecto es multi-tenant, verifica que TODAS las queries a la base de datos filtren por tenant/workspace del usuario autenticado, no solo del lado del cliente.
- Verifica que los roles (admin/usuario/superadmin, etc.) se validen en el backend, no solo se oculten en el frontend con `*ngIf`.
- Busca cualquier endpoint que reciba una URL y haga una petición HTTP saliente con ella (fetch, axios, http a partir de input del usuario) — riesgo de SSRF. Verifica si hay validación de destino (bloqueo de IPs privadas/loopback/metadata de cloud).

### 2. Configuración y superficie expuesta
- Revisa `docker-compose.yml`: ¿qué puertos están expuestos al host/público? Verifica que la base de datos, paneles de administración (pgAdmin, n8n, Portainer) y APIs internas NO estén expuestas directamente, solo el puerto del reverse proxy.
- Busca credenciales por defecto o hardcodeadas en configuración, docker-compose, o variables de entorno versionadas.
- Verifica headers de seguridad HTTP (CSP, HSTS, X-Frame-Options, X-Content-Type-Options) — revisa si se usa Helmet.js o equivalente.
- Revisa la configuración de CORS: busca `origin: '*'` o configuraciones demasiado permisivas.
- Verifica que los mensajes de error en producción no filtren stack traces, rutas de archivos, o detalles de la base de datos al cliente.

### 3. Secretos y cadena de suministro
- Busca API keys, tokens, contraseñas o secretos hardcodeados en el código (backend, frontend, workflows de n8n si aplica).
- Verifica que exista `.env` en `.gitignore` y que no haya secretos en el historial de git.
- Revisa `package.json`/lockfile: identifica dependencias con vulnerabilidades conocidas (ejecuta `npm audit` o equivalente) y dependencias sin actualizar hace mucho tiempo.
- Si hay integraciones con exchanges (trading) o pasarelas de pago: confirma que las API keys usadas tengan el mínimo privilegio posible (ej. solo trading, nunca retiro/withdrawal).

### 4. API y validación de entrada
- Verifica que cada endpoint que recibe body/query/params tenga validación de esquema (class-validator, Zod, Joi, etc.), no solo validación en el formulario de Angular.
- Busca uso de queries SQL construidas por concatenación de strings en vez de queries parametrizadas u ORM.
- Verifica si existe rate limiting en endpoints sensibles (login, recuperación de contraseña, generación de documentos, webhooks).
- Si hay webhooks entrantes (WhatsApp Cloud API, Meta, pasarelas de pago): verifica que se valide la firma/token del remitente antes de procesar el payload.

### 5. Autenticación y manejo de sesión
- Revisa la implementación de JWT: tiempo de expiración de access token, existencia de refresh token, mecanismo de revocación/rotación.
- Verifica que no se guarde información sensible sin cifrar dentro del payload del JWT.
- Revisa el hash de contraseñas (debe usar bcrypt/argon2 con costo adecuado, nunca MD5/SHA1 plano).

### 6. Seguridad específica del cliente móvil (Ionic/Capacitor)
- Busca tokens, API keys o secretos guardados en `localStorage` o `SharedPreferences` planos dentro del código de Capacitor — deberían usar almacenamiento seguro (Keychain/Keystore vía un plugin de secure storage).
- Revisa los plugins de Capacitor instalados y qué permisos nativos solicitan (cámara, ubicación, contactos); señala cualquiera que pida más de lo que la app necesita.
- Verifica si hay certificate pinning configurado para tráfico sensible (financiero, datos de salud).

### 7. Frontend web (Angular)
- Busca uso de `[innerHTML]`, `bypassSecurityTrustHtml`, `bypassSecurityTrustUrl` u otras APIs que desactivan el sanitizado automático de Angular — evalúa si el contenido insertado puede venir de un usuario.
- Verifica dónde se guarda el token de autenticación (localStorage vs cookie httpOnly) y señala el riesgo de XSS si está en localStorage.
- Revisa que los guards de ruta no sean el único mecanismo de protección de datos sensibles.

### 8. Logging y manejo de errores
- Verifica que existan logs de eventos de seguridad: intentos fallidos de login, cambios de permisos, accesos administrativos.
- Verifica que los logs no registren contraseñas, tokens completos, o datos personales sensibles en texto plano.
- Revisa el manejo global de excepciones (exception filters en NestJS / error middleware en Express): confirma que no se "falle abierto" (fail-open) en validaciones de seguridad ante un error inesperado.

## Formato del resultado

Entrega los hallazgos como una tabla o lista priorizada así:

```
[CRÍTICO / ALTO / MEDIO / BAJO] — <Título del hallazgo>
Archivo: <ruta:línea si aplica>
Descripción: <qué está mal y por qué es un riesgo>
Corrección sugerida: <cambio concreto, con snippet de código si es corto>
```

Al final, agrega una sección de "Quick wins" con las 5 correcciones más fáciles de implementar que tengan mayor impacto en reducir riesgo.

No apliques ningún cambio todavía — primero muéstrame el informe completo y decidimos juntos qué priorizar.
