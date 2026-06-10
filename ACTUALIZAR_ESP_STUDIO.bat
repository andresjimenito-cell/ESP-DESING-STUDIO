@echo off
REM ========================================================================
REM ESP DESIGN STUDIO - ACCESO DIRECTO DE ACTUALIZACION (ASCII)
REM ========================================================================
REM Este script redirige la ejecucion al actualizador ubicado en la carpeta
REM interna del proyecto sin usar bloques de parentesis.
REM ========================================================================

set "CURRENT_DIR=%~dp0"
cd /d "%CURRENT_DIR%"

if not exist "ESP DESING ESTUDIO\ACTUALIZAR_ESP_STUDIO.bat" goto :error_missing

call "ESP DESING ESTUDIO\ACTUALIZAR_ESP_STUDIO.bat"
exit /b 0

:error_missing
echo [X] ERROR: No se pudo encontrar el actualizador en "ESP DESING ESTUDIO\ACTUALIZAR_ESP_STUDIO.bat".
echo [!] Asegurese de que las carpetas no hayan sido renombradas.
pause
exit /b 1
