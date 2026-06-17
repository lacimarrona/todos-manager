@echo off
title TechCheck - Sistema de Mantenimiento
color 0A

echo.
echo  ==========================================
echo   TechCheck v1.0.0 - Iniciando...
echo  ==========================================
echo.

REM Verificar que Node.js este instalado
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo  [ERROR] Node.js no esta instalado.
    echo  Descargalo en: https://nodejs.org
    pause
    exit /b 1
)

REM Mostrar version de Node
for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
echo  Node.js: %NODE_VER%

REM Instalar dependencias del backend si no existen
if not exist "backend\node_modules" (
    echo.
    echo  Instalando dependencias (primera vez)...
    cd backend
    call npm install --silent
    cd ..
    echo  Dependencias instaladas.
)

echo.
echo  Iniciando servidor en http://localhost:3000
echo.
echo  Para cerrar la aplicacion, cierre esta ventana.
echo  ==========================================
echo.

REM Abrir el navegador despues de 2 segundos
start /b cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000"

REM Iniciar el servidor
cd backend
node index.js

pause
    