@echo off
title ESP Design Studio
cd /d "%~dp0"

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
