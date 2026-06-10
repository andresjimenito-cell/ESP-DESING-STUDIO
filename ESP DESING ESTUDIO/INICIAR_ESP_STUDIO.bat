@echo off
title ESP Design Studio
cd /d "%~dp0"

REM Asegurar que existan los accesos directos y carpeta FORMATOS en el directorio padre sin usar parentesis
if exist "..\INICIAR_ESP_STUDIO.bat" goto :skip_init_shortcut
echo @echo off > "..\INICIAR_ESP_STUDIO.bat"
echo cd /d "%%~dp0" >> "..\INICIAR_ESP_STUDIO.bat"
echo if not exist "ESP DESING ESTUDIO\INICIAR_ESP_STUDIO.bat" goto :error >> "..\INICIAR_ESP_STUDIO.bat"
echo call "ESP DESING ESTUDIO\INICIAR_ESP_STUDIO.bat" >> "..\INICIAR_ESP_STUDIO.bat"
echo exit /b 0 >> "..\INICIAR_ESP_STUDIO.bat"
echo :error >> "..\INICIAR_ESP_STUDIO.bat"
echo echo [X] ERROR: No se pudo encontrar el iniciador en "ESP DESING ESTUDIO\INICIAR_ESP_STUDIO.bat". >> "..\INICIAR_ESP_STUDIO.bat"
echo pause >> "..\INICIAR_ESP_STUDIO.bat"
echo exit /b 1 >> "..\INICIAR_ESP_STUDIO.bat"
:skip_init_shortcut

if exist "..\ACTUALIZAR_ESP_STUDIO.bat" goto :skip_update_shortcut
echo @echo off > "..\ACTUALIZAR_ESP_STUDIO.bat"
echo set "CURRENT_DIR=%%~dp0" >> "..\ACTUALIZAR_ESP_STUDIO.bat"
echo cd /d "%%CURRENT_DIR%%" >> "..\ACTUALIZAR_ESP_STUDIO.bat"
echo if not exist "ESP DESING ESTUDIO\ACTUALIZAR_ESP_STUDIO.bat" goto :error_missing >> "..\ACTUALIZAR_ESP_STUDIO.bat"
echo call "ESP DESING ESTUDIO\ACTUALIZAR_ESP_STUDIO.bat" >> "..\ACTUALIZAR_ESP_STUDIO.bat"
echo exit /b 0 >> "..\ACTUALIZAR_ESP_STUDIO.bat"
echo :error_missing >> "..\ACTUALIZAR_ESP_STUDIO.bat"
echo echo [X] ERROR: No se pudo encontrar el actualizador en "ESP DESING ESTUDIO\ACTUALIZAR_ESP_STUDIO.bat". >> "..\ACTUALIZAR_ESP_STUDIO.bat"
echo echo [!] Asegurese de que las carpetas no hayan sido renombradas. >> "..\ACTUALIZAR_ESP_STUDIO.bat"
echo pause >> "..\ACTUALIZAR_ESP_STUDIO.bat"
echo exit /b 1 >> "..\ACTUALIZAR_ESP_STUDIO.bat"
:skip_update_shortcut

if exist "..\FORMATOS" goto :skip_copy_formatos
if not exist "FORMATOS" goto :skip_copy_formatos
echo [*] Copiando carpeta FORMATOS al directorio principal...
xcopy /E /I /Y "FORMATOS" "..\FORMATOS" >nul 2>&1
:skip_copy_formatos

REM Verificar si Node.js esta instalado
echo [*] Verificando si Node.js esta instalado en el sistema...
node --version >nul 2>&1
if %errorlevel% equ 0 goto :node_ready

REM Comprobar ruta comun de 64 bits
if not exist "C:\Program Files\nodejs\node.exe" goto :skip_node64
set "PATH=%PATH%;C:\Program Files\nodejs"
goto :node_ready_check
:skip_node64

REM Comprobar ruta comun de 32 bits
if not exist "C:\Program Files (x86)\nodejs\node.exe" goto :skip_node32
set "PATH=%PATH%;C:\Program Files (x86)\nodejs"
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
if exist "node_modules" goto :skip_npm_install
echo [*] No se detectaron dependencias instaladas. Instalando (npm install)...
call npm install
:skip_npm_install

echo [*] Liberando puertos 3000 y 4000 (limpieza preventiva)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :4000') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do taskkill /F /PID %%a >nul 2>&1

echo [*] Preparando detector de servidor en segundo plano...
start /b powershell -NoProfile -Command "$chrome = @( ${env:ProgramFiles}, ${env:ProgramFiles(x86)}, ${env:LocalAppData} ) | Where-Object { $_ } | ForEach-Object { Join-Path $_ 'Google\Chrome\Application\chrome.exe' } | Where-Object { Test-Path $_ } | Select-Object -First 1; while ($true) { try { $w = New-Object System.Net.Sockets.TcpClient('127.0.0.1', 3000); if ($w.Connected) { $w.Close(); break; } } catch {} Start-Sleep -Milliseconds 250 }; if ($chrome) { Start-Process $chrome -ArgumentList '--app=http://localhost:3000' } else { Start-Process msedge -ArgumentList '--app=http://localhost:3000' }"

echo [*] Iniciando servidores locales (Vite + Express)...
call npm run dev
exit /b 0
