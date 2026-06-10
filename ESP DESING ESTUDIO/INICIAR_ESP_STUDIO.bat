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

echo [*] Liberando puertos 3000 y 4000 (limpieza preventiva)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :4000') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do taskkill /F /PID %%a >nul 2>&1

echo [*] Preparando detector de servidor en segundo plano...
start /b powershell -NoProfile -Command "$chrome = @( ${env:ProgramFiles}, ${env:ProgramFiles(x86)}, ${env:LocalAppData} ) | Where-Object { $_ } | ForEach-Object { Join-Path $_ 'Google\Chrome\Application\chrome.exe' } | Where-Object { Test-Path $_ } | Select-Object -First 1; while ($true) { try { $w = New-Object System.Net.Sockets.TcpClient('127.0.0.1', 3000); if ($w.Connected) { $w.Close(); break; } } catch {} Start-Sleep -Milliseconds 250 }; if ($chrome) { Start-Process $chrome -ArgumentList '--app=http://localhost:3000' } else { Start-Process msedge -ArgumentList '--app=http://localhost:3000' }"

echo [*] Iniciando servidores locales (Vite + Express)...
call npm run dev
exit /b 0
