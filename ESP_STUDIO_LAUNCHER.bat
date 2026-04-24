@echo off
title ESP DESIGN - Professional Edition
cd /d "%~dp0"
:: Ejecutar el script forzando la codificación UTF-8 para evitar errores de dibujo
powershell -NoProfile -ExecutionPolicy Bypass -Command "$c = Get-Content -Raw -Encoding UTF8 'ESP_LAUNCHER.ps1'; Invoke-Expression $c"
if %errorlevel% neq 0 pause