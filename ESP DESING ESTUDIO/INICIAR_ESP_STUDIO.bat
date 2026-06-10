@echo off
title ESP Design Studio
cd /d "%~dp0"

REM Asegurar que existan los accesos directos y carpeta FORMATOS en el directorio padre
if not exist "..\INICIAR_ESP_STUDIO.bat" (
    (
        echo @echo off
        echo cd /d "%%~dp0"
        echo if not exist "ESP DESING ESTUDIO\INICIAR_ESP_STUDIO.bat" goto :error
        echo call "ESP DESING ESTUDIO\INICIAR_ESP_STUDIO.bat"
        echo exit /b 0
        echo :error
        echo echo [X] ERROR: No se pudo encontrar el iniciador en "ESP DESING ESTUDIO\INICIAR_ESP_STUDIO.bat".
        echo pause
        echo exit /b 1
    ) > "..\INICIAR_ESP_STUDIO.bat"
)

if not exist "..\ACTUALIZAR_ESP_STUDIO.bat" (
    (
        echo @echo off
        echo set "CURRENT_DIR=%%~dp0"
        echo cd /d "%%CURRENT_DIR%%"
        echo if not exist "ESP DESING ESTUDIO\ACTUALIZAR_ESP_STUDIO.bat" goto :error_missing
        echo call "ESP DESING ESTUDIO\ACTUALIZAR_ESP_STUDIO.bat"
        echo exit /b 0
        echo :error_missing
        echo echo [X] ERROR: No se pudo encontrar el actualizador en "ESP DESING ESTUDIO\ACTUALIZAR_ESP_STUDIO.bat".
        echo echo [!] Asegurese de que las carpetas no hayan sido renombradas.
        echo pause
        echo exit /b 1
    ) > "..\ACTUALIZAR_ESP_STUDIO.bat"
)

if not exist "..\FORMATOS" (
    if exist "FORMATOS" (
        echo [*] Copiando carpeta FORMATOS al directorio principal...
        xcopy /E /I /Y "FORMATOS" "..\FORMATOS" >nul 2>&1
    )
)

echo [*] Liberando puertos 3000 y 4000 (limpieza preventiva)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :4000') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do taskkill /F /PID %%a >nul 2>&1

echo [*] Buscando navegador...
set "CHROME_PATH="

if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" set "CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not defined CHROME_PATH if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" set "CHROME_PATH=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if not defined CHROME_PATH if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME_PATH=%LocalAppData%\Google\Chrome\Application\chrome.exe"

if not defined CHROME_PATH goto :use_edge

echo [*] Abriendo en Google Chrome (App Mode)...
start "" "%CHROME_PATH%" --app=http://localhost:3000
goto :start_dev

:use_edge
echo [*] Google Chrome no detectado. Abriendo en Microsoft Edge (App Mode)...
start msedge --app=http://localhost:3000

:start_dev
echo [*] Iniciando servidores locales (Vite + Express)...
call npm run dev
