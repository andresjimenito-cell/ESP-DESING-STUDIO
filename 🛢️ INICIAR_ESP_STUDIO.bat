@echo off
title ESP Design Studio
cd /d "%~dp0"

REM 1. Verificar si Node.js ya esta disponible globalmente
echo [*] Verificando si Node.js esta instalado en el sistema...
node --version >nul 2>&1
if %errorlevel% equ 0 goto :node_ready

REM 2. Verificar si ya existe una version portatil local
echo [*] Buscando version portatil local de Node.js...
if not exist "%~dp0node-portable\node-v20.11.1-win-x64\node.exe" goto :download_portable_node
set "PATH=%~dp0node-portable\node-v20.11.1-win-x64;%PATH%"
goto :node_ready_check

:download_portable_node
echo.
echo [!] ADVERTENCIA: Node.js no esta instalado en el sistema.
echo [*] Intentando descargar e instalar la version PORTATIL de Node.js (no requiere privilegios de administrador)...
echo [*] Descargando desde nodejs.org (LTS)...

set "NODE_ZIP_URL=https://nodejs.org/dist/v20.11.1/node-v20.11.1-win-x64.zip"
set "NODE_ZIP_FILE=%temp%\node-portable.zip"
set "NODE_PORTABLE_DIR=%~dp0node-portable"

if not exist "%NODE_PORTABLE_DIR%" mkdir "%NODE_PORTABLE_DIR%"

powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Write-Host 'Descargando Node.js portatil...'; Invoke-WebRequest -Uri '%NODE_ZIP_URL%' -OutFile '%NODE_ZIP_FILE%'"
if %errorlevel% neq 0 goto :error_download_node

echo [*] Extrayendo archivos...
powershell -Command "Write-Host 'Extrayendo...'; Expand-Archive -Path '%NODE_ZIP_FILE%' -DestinationPath '%NODE_PORTABLE_DIR%' -Force"
if %errorlevel% neq 0 goto :error_extract_node

del "%NODE_ZIP_FILE%" >nul 2>&1
set "PATH=%~dp0node-portable\node-v20.11.1-win-x64;%PATH%"
echo [OK] Node.js portatil configurado correctamente.
goto :node_ready_check

:node_ready_check
node --version >nul 2>&1
if %errorlevel% equ 0 goto :node_ready

:error_download_node
echo.
echo [X] ERROR: No se pudo descargar Node.js automaticamente (posible bloqueo de red o falta de internet).
goto :manual_node_instructions

:error_extract_node
echo.
echo [X] ERROR: Fallo al extraer el archivo zip de Node.js portatil.
goto :manual_node_instructions

:manual_node_instructions
echo.
echo =======================================================================
echo   INSTRUCCIONES PARA INSTALACION MANUAL SIN PERMISOS DE ADMINISTRADOR:
echo =======================================================================
echo   1. Descargue el archivo ZIP oficial de Node.js desde este enlace:
echo      https://nodejs.org/dist/v20.11.1/node-v20.11.1-win-x64.zip
echo.
echo   2. Cree una carpeta llamada "node-portable" en este mismo directorio:
echo      %~dp0node-portable
echo.
echo   3. Extraiga el contenido del ZIP dentro de la carpeta "node-portable".
echo      Debe quedar la estructura:
echo      %~dp0node-portable\node-v20.11.1-win-x64\node.exe
echo.
echo   4. Vuelva a iniciar este archivo BAT.
echo =======================================================================
echo.
pause
exit /b 1

:node_ready
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo [OK] Node.js disponible: %NODE_VERSION%

REM Comprobar si existe la carpeta node_modules, si no existe ejecutar npm install
if exist "ESP DESING ESTUDIO\node_modules" goto :skip_npm_install
echo [*] No se detectaron dependencias instaladas. Instalando (npm install)...
cd /d "%~dp0ESP DESING ESTUDIO"
call npm install
cd /d "%~dp0"
:skip_npm_install

echo [*] Liberando puertos 3000 y 4000 (limpieza preventiva)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :4000') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do taskkill /F /PID %%a >nul 2>&1

echo [*] Preparando detector de servidor en segundo plano...
start /b powershell -NoProfile -Command "$chrome = @( ${env:ProgramFiles}, ${env:ProgramFiles(x86)}, ${env:LocalAppData} ) | Where-Object { $_ } | ForEach-Object { Join-Path $_ 'Google\Chrome\Application\chrome.exe' } | Where-Object { Test-Path $_ } | Select-Object -First 1; while ($true) { try { $w = New-Object System.Net.Sockets.TcpClient('127.0.0.1', 3000); if ($w.Connected) { $w.Close(); break; } } catch {} Start-Sleep -Milliseconds 250 }; if ($chrome) { Start-Process $chrome -ArgumentList '--app=http://localhost:3000' } else { Start-Process msedge -ArgumentList '--app=http://localhost:3000' }"

echo [*] Iniciando servidores locales (Vite + Express)...
cd /d "%~dp0ESP DESING ESTUDIO"
call npm run dev
exit /b 0


