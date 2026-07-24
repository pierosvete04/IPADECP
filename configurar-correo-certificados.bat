@echo off
setlocal
cd /d "%~dp0"
title IPADECP - Configurar envio de certificados por correo

echo ============================================
echo   IPADECP - Configurar envio de correo
echo ============================================
echo.
echo Este script conecta el envio de certificados por correo (Resend) con
echo el proyecto de Supabase. La API key que ingreses se queda solo en tu
echo computadora: nunca se muestra en el chat ni se guarda en el proyecto.
echo.
echo Antes de continuar, si todavia no lo hiciste:
echo   1. Crea una cuenta gratis en https://resend.com
echo   2. Agrega el dominio ipadecp.com.pe (Domains - Add Domain)
echo   3. Copia los registros DNS que te muestre Resend y agregalos donde
echo      administras el dominio ipadecp.com.pe (tu proveedor de hosting/dominio).
echo   4. Espera a que Resend marque el dominio como "Verified" (puede tardar
echo      unos minutos u horas segun el proveedor).
echo   5. Ve a API Keys - Create API Key y copia la key (empieza con "re_").
echo.
echo Si el dominio todavia no esta verificado puedes igual configurar la key
echo ahora: el sistema va a quedar listo, solo que el envio de correos real
echo fallara con un mensaje claro hasta que el dominio quede verificado.
echo.

set /p RESEND_KEY="Pega aqui tu API key de Resend y presiona Enter: "

if "%RESEND_KEY%"=="" (
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
call npx supabase secrets set RESEND_API_KEY=%RESEND_KEY% --project-ref gqzahhjphyqdcausuqgl

if errorlevel 1 (
    echo.
    echo Algo fallo al guardar la key. Revisa el mensaje de arriba.
) else (
    echo.
    echo Listo. El boton "Enviar por correo" del panel admin ya puede usar Resend.
    echo Si tu dominio ipadecp.com.pe todavia no esta verificado en Resend, el
    echo envio va a fallar con un mensaje de error hasta que lo verifiques.
)

echo.
pause
