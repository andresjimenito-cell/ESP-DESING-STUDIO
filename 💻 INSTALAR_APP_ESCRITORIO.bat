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

echo [*] Navegador detectado en: %BROWSER_PATH%

set "ICON_DIR=%LocalAppData%\ESPDesignStudio"
set "ICON_PATH=%ICON_DIR%\app-icon.ico"
set "TARGET_URL=https://espdesing.vercel.app"

if not exist "%ICON_DIR%" mkdir "%ICON_DIR%"

echo [*] Descargando logotipo de la aplicacion...
where curl.exe >nul 2>&1
if %errorlevel% equ 0 (
    curl.exe -s -L -o "%ICON_PATH%" "%TARGET_URL%/favicon.ico"
) else (
    powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('%TARGET_URL%/favicon.ico', '%ICON_PATH%')"
)

echo [*] Creando acceso directo en el Escritorio con icono personalizado...
powershell -NoProfile -Command "$desktop = [Environment]::GetFolderPath('Desktop'); $ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut(\"$desktop\ESP Design Studio.lnk\"); $s.TargetPath = '%BROWSER_PATH%'; $s.Arguments = '--app=%TARGET_URL%/'; $s.Description = 'ESP Design Studio'; if (Test-Path '%ICON_PATH%') { $s.IconLocation = '%ICON_PATH%' }; $s.Save()"

echo.
echo ========================================================================
echo   [OK] !APLICACION DE ESCRITORIO INSTALADA CON EXITO!
echo ========================================================================
echo   [*] Se ha creado un acceso directo llamado "ESP Design Studio" en tu
echo       Escritorio con su logo personalizado.
echo ========================================================================
echo.
pause
exit /b 0
