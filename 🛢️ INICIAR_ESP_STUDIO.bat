@echo off
title ESP Design Studio
cd /d "%~dp0"

REM Verificar si Node.js esta instalado en el sistema
echo [*] Verificando si Node.js esta instalado en el sistema...
node --version >nul 2>&1
if %errorlevel% equ 0 goto :node_ready

REM Comprobar ruta comun de 64 bits
if not exist "C:\Program Files\nodejs\node.exe" goto :skip_node64
set "PATH=%PATH%;C:\Program Files\nodejs"
goto :node_ready_check
:skip_node64

REM Comprobar ruta comun de 32 bits
if not exist "C:\Program Files\nodejs\node.exe" goto :skip_node32
set "PATH=%PATH%;C:\Program Files\nodejs"
goto :node_ready_check
:skip_node32

goto :install_node

:node_ready_check
node --version >nul 2>&1
if %errorlevel% equ 0 goto :node_ready

:install_node
echo.
echo [!] ADVERTENCIA: Node.js (necesario para ejecutar la aplicacion) no esta instalado.
echo [*] Iniciando instalacion automatica de Node.js...

REM Intentar primero con winget
winget --version >nul 2>&1
if %errorlevel% neq 0 goto :install_node_powershell

echo [*] Instalandose Node.js mediante Windows Package Manager (winget)...
winget install --id OpenJS.NodeJS.LTS -e --silent --accept-source-agreements --accept-package-agreements
if %errorlevel% equ 0 goto :node_installed_ok
echo [!] La instalacion con winget no tuvo exito. Probando metodo alternativo...

:install_node_powershell
echo [*] Descargando instalador oficial de Node.js (LTS)...
set "NODE_URL=https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi"
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $out = '$env:TEMP\node_installer.msi'; Write-Host 'Descargando...'; Invoke-WebRequest -Uri '%NODE_URL%' -OutFile $out; Write-Host 'Instalando silenciosamente...'; Start-Process msiexec.exe -ArgumentList '/i', $out, '/quiet', '/norestart' -Wait; Remove-Item $out"

:node_installed_ok
REM Agregar la ruta tipica al PATH de esta sesion
set "PATH=%PATH%;C:\Program Files\nodejs;C:\Program Files (x86)\nodejs"

REM Re-verificar instalacion
node --version >nul 2>&1
if %errorlevel% neq 0 goto :error_node_install
echo [OK] Node.js se ha instalado exitosamente.
goto :node_ready

:error_node_install
echo.
echo [X] ERROR: No se pudo completar la instalacion automatica de Node.js.
echo [!] Instale Node.js manualmente desde: https://nodejs.org/
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


