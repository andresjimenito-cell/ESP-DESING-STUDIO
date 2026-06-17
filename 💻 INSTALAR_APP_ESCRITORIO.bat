@echo off
title Instalador ESP Design Studio
cd /d "%~dp0"

echo ========================================================================
echo   I N S T A L A D O R   D E   A P L I C A C I O N   D E   E S C R I T O R I O
echo ========================================================================
echo.
echo [*] Abriendo el instalador oficial en tu navegador...
echo [*] Por favor, haz clic en "Instalar" en la ventana emergente que aparezca.
echo.

start "" "https://espdesing.vercel.app/?install=true"

exit /b 0
