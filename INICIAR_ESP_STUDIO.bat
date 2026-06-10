@echo off
cd /d "%~dp0"

if not exist "ESP DESING ESTUDIO\INICIAR_ESP_STUDIO.bat" goto :error

call "ESP DESING ESTUDIO\INICIAR_ESP_STUDIO.bat"
exit /b 0

:error
echo [X] ERROR: No se pudo encontrar el iniciador en "ESP DESING ESTUDIO\INICIAR_ESP_STUDIO.bat".
pause
exit /b 1
