@echo off
title ESP Design Studio
cd /d "%~dp0"

echo [*] Liberando puertos 3000 y 4000 (limpieza preventiva)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :4000') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do taskkill /F /PID %%a >nul 2>&1

echo [*] Preparando detector de servidor en segundo plano...
start /b powershell -NoProfile -Command "$chrome = @( ${env:ProgramFiles}, ${env:ProgramFiles(x86)}, ${env:LocalAppData} ) | Where-Object { $_ } | ForEach-Object { Join-Path $_ 'Google\Chrome\Application\chrome.exe' } | Where-Object { Test-Path $_ } | Select-Object -First 1; while ($true) { try { $w = New-Object System.Net.Sockets.TcpClient('127.0.0.1', 3000); if ($w.Connected) { $w.Close(); break; } } catch {} Start-Sleep -Milliseconds 250 }; if ($chrome) { Start-Process $chrome -ArgumentList '--app=http://localhost:3000' } else { Start-Process msedge -ArgumentList '--app=http://localhost:3000' }"

echo [*] Iniciando servidores locales (Vite + Express)...
cd /d "%~dp0ESP DESING ESTUDIO"
call npm run dev
exit /b 0
