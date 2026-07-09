# Prompt: instalar y correr escaneo de seguridad automatizado

> Pega esto en Claude Code dentro de la raíz del repo que quieras analizar.

---

Quiero que instales y ejecutes un set de herramientas de seguridad open source sobre este repositorio, interpretes los resultados en el contexto real del código, y me entregues un informe priorizado. Sigue este orden:

## 1. gitleaks — secretos filtrados en el historial de git
- Instala gitleaks (via `brew install gitleaks`, descarga del release de GitHub, o el contenedor Docker `zricethezav/gitleaks` si no quieres instalar nada en el sistema).
- Corre un escaneo sobre TODO el historial de commits, no solo el estado actual: `gitleaks detect --source . --verbose`
- Para cada hallazgo, dime si el secreto sigue activo/en uso actualmente en el código o si ya fue rotado/eliminado, y qué tan grave es (ej. una API key de producción vs. una de un entorno de pruebas).

## 2. npm audit — dependencias vulnerables
- Corre `npm audit --audit-level=moderate` en cada `package.json` del repo (si es un monorepo con backend y frontend separados, hazlo en cada uno).
- Para cada vulnerabilidad alta o crítica, revisa si el código realmente usa la función/módulo afectado (no todas las vulnerabilidades de una dependencia son explotables si no usas esa parte del paquete).

## 3. Semgrep — análisis estático del código
- Instala Semgrep (`pip install semgrep --break-system-packages` o vía Docker `returntocorp/semgrep`).
- Corre `semgrep --config auto .` sobre el repo completo.
- Para cada hallazgo relevante (ignora los de severidad INFO salvo que se vean claramente explotables), ve al archivo y línea señalados, y evalúa si es un falso positivo dado el contexto real del código, o un riesgo genuino — explica por qué.

## 4. Trivy — vulnerabilidades en imágenes Docker (si el proyecto usa Docker)
- Instala Trivy (`brew install trivy` o Docker `aquasec/trivy`).
- Si hay `docker-compose.yml` o `Dockerfile`, corre `trivy image <nombre-de-la-imagen>` sobre cada imagen que se construye o se usa como base.
- Reporta CVEs críticas/altas y si hay una versión de la imagen base disponible que las resuelva.

## Formato del informe final

Consolida todo en una sola tabla priorizada por severidad real (no la severidad "de fábrica" de cada herramienta, sino tu evaluación de explotabilidad en este proyecto específico):

```
[CRÍTICO / ALTO / MEDIO / BAJO] — <Herramienta que lo encontró> — <Título>
Archivo/ubicación: <ruta:línea o imagen/paquete>
¿Explotable en este contexto?: <sí/no/depende, y por qué>
Corrección sugerida: <acción concreta>
```

Al final, dime cuáles arreglarías tú mismo ahora mismo si te doy luz verde, y cuáles requieren que yo decida algo primero (ej. rotar una credencial, cambiar de librería).

No hagas cambios en el código todavía — primero el informe completo.
