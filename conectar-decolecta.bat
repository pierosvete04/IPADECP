@echo off
setlocal
cd /d "%~dp0"
title IPADECP - Conectar verificacion de DNI (Decolecta)

echo ============================================
echo   IPADECP - Conectar Decolecta (verificacion de DNI)
echo ============================================
echo.
echo Este script conecta la verificacion de DNI contra RENIEC (via Decolecta)
echo con el proyecto de Supabase. La API key que ingreses se queda solo en tu
echo computadora: nunca se muestra en el chat ni se guarda en el proyecto.
echo.
echo Antes de continuar, si todavia no lo hiciste:
echo   1. Crea una cuenta en https://decolecta.com
echo   2. Ve a tu panel de API Keys y copia tu key (empieza con "sk_").
echo.

set /p DECOLECTA_KEY="Pega aqui tu API key de Decolecta y presiona Enter: "

if "%DECOLECTA_KEY%"=="" (
    echo.
    echo No ingresaste ninguna key. Cerrando sin hacer cambios.
    pause
    exit /b 1
)

echo.
echo Verificando que tengas sesion iniciada en Supabase CLI...
call npx supabase projects list >nul 2>&1
if errorlevel 1 (
    echo.
    echo Necesitas iniciar sesion una vez. Se va a abrir tu navegador:
    call npx supabase login
)

echo.
echo Guardando la API key en el proyecto de Supabase...
call npx supabase secrets set DECOLECTA_API_KEY=%DECOLECTA_KEY% --project-ref gqzahhjphyqdcausuqgl

if errorlevel 1 (
    echo.
    echo Algo fallo al guardar la key. Revisa el mensaje de arriba.
) else (
    echo.
    echo Listo. El boton "Verificar con RENIEC" del panel admin ya puede usar Decolecta.
)

echo.
pause
