@echo off
setlocal
cd /d "%~dp0"
title IPADECP - Aula Virtual (servidor)

echo ============================================
echo   IPADECP - Aula Virtual
echo   Iniciando servidor de desarrollo...
echo ============================================

if not exist "node_modules" (
    echo Instalando dependencias, esto puede tardar unos minutos...
    call npm install
)

echo.
echo El servidor va a correr en ESTA misma ventana.
echo No la cierres mientras estes probando el aula virtual.
echo Para detenerlo: presiona Ctrl+C aqui y confirma con S.
echo.

REM Corre el servidor en segundo plano de esta misma consola (sin abrir otra ventana)
start /b "" npm run dev

echo Esperando a que el servidor levante en http://localhost:3000 ...
timeout /t 6 /nobreak >nul

echo Abriendo el aula virtual en el navegador (una sola pestana)...
start "" "http://localhost:3000/login"

echo.
echo Listo. Enlaces utiles una vez dentro:
echo   Alumno/aula:            http://localhost:3000/login
echo   Panel administrable:    http://localhost:3000/admin/login
echo.
echo Deja esta ventana abierta: aqui veras los logs del servidor.
pause
