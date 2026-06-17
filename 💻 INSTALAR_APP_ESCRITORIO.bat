@echo off
title Instalador ESP Design Studio
cd /d "%~dp0"

echo ========================================================================
echo   I N S T A L A D O R   D E   A P L I C A C I O N   D E   E S C R I T O R I O
echo ========================================================================
echo.
echo [*] Buscando navegador compatible (Chrome o Edge)...

set "BROWSER_PATH="
set "CHROME_PATH=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
set "CHROME_PATH_X86=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
set "CHROME_PATH_LOCAL=%LocalAppData%\Google\Chrome\Application\chrome.exe"
set "EDGE_PATH=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"

if exist "%CHROME_PATH%" (
    set "BROWSER_PATH=%CHROME_PATH%"
) else if exist "%CHROME_PATH_X86%" (
    set "BROWSER_PATH=%CHROME_PATH_X86%"
) else if exist "%CHROME_PATH_LOCAL%" (
    set "BROWSER_PATH=%CHROME_PATH_LOCAL%"
) else if exist "%EDGE_PATH%" (
    set "BROWSER_PATH=%EDGE_PATH%"
)

if "%BROWSER_PATH%"=="" (
    echo [X] ERROR: No se encontro Google Chrome ni Microsoft Edge.
    pause
    exit /b 1
)

echo [*] Navegador detectado: %BROWSER_PATH%
echo [*] Abriendo el instalador en modo ventana...
echo [*] Haz clic en "INSTALAR APP" dentro de la ventana que se acaba de abrir.
echo.

start "" "%BROWSER_PATH%" --app=https://espdesing.vercel.app/?install=true

exit /b 0
