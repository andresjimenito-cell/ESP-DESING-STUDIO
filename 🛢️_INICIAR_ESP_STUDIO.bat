@echo off
title ESP DESIGN - Professional Edition
cd /d "%~dp0"
:: Ejecutar el script desde su nueva ubicación técnica
powershell -NoProfile -ExecutionPolicy Bypass -Command "$c = Get-Content -Raw -Encoding UTF8 'services\ESP_LAUNCHER.ps1'; Invoke-Expression $c"
if %errorlevel% neq 0 pause
