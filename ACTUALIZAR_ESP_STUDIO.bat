@echo off
title ESP Design Studio - Actualizador
color 0B
chcp 65001 >nul
cls

echo ========================================================================
echo       E S P   D E S I G N   S T U D I O   -   A C T U A L I Z A R
echo ========================================================================
echo   [ Script de Actualizacion y Sincronizacion Automatica - ASCII ]
echo ========================================================================
echo.

REM 1. Detectar el directorio raiz del proyecto
set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

if exist "package.json" goto :found_dir
if exist "ESP DESING ESTUDIO\package.json" (
    cd /d "ESP DESING ESTUDIO"
    goto :found_dir
)
if exist "..\package.json" (
    cd /d ".."
    goto :found_dir
)

echo [X] ERROR: No se pudo localizar el directorio raiz del proyecto.
echo [!] Asegurese de que el archivo 'package.json' existe en esta carpeta.
pause
exit /b 1

:found_dir
echo [*] Directorio de trabajo establecido: %CD%

REM 2. Verificar si Git esta instalado
echo [*] Verificando si Git esta instalado en el sistema...
git --version >nul 2>&1
if %errorlevel% equ 0 goto :git_ready

echo.
echo [!] ADVERTENCIA: Git no esta instalado en este sistema.
echo [*] Iniciando preparacion para la instalacion automatica de Git...

REM Intentar primero con winget (Windows Package Manager)
winget --version >nul 2>&1
if %errorlevel% neq 0 goto :install_powershell

echo [*] Instalandose Git mediante Windows Package Manager (winget)...
winget install --id Git.Git -e --silent --accept-source-agreements --accept-package-agreements
if %errorlevel% equ 0 goto :git_installed_ok
echo [!] La instalacion con winget no tuvo exito. Probando metodo alternativo...

:install_powershell
echo [*] Descargando el instalador oficial de Git en segundo plano...
set "GIT_URL=https://github.com/git-for-windows/git/releases/download/v2.43.0.windows.1/Git-2.43.0-64-bit.exe"
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $out = '$env:TEMP\git_installer.exe'; Write-Host 'Descargando...'; Invoke-WebRequest -Uri '%GIT_URL%' -OutFile $out; Write-Host 'Instalando silenciosamente...'; Start-Process $out -ArgumentList '/SILENT /NORESTART /CLOSEAPPLICATIONS /RESTARTAPPLICATIONS /SP-' -Wait; Remove-Item $out"

:git_installed_ok
REM Agregar la ruta tipica de instalacion de Git al PATH de esta sesion
set "PATH=%PATH%;C:\Program Files\Git\cmd;C:\Program Files (x86)\Git\cmd"

REM Re-verificar instalacion
git --version >nul 2>&1
if %errorlevel% neq 0 goto :error_git_install
echo [OK] Git se ha instalado exitosamente.

:git_ready
for /f "tokens=*" %%i in ('git --version') do set GIT_VERSION=%%i
echo [OK] Git disponible: %GIT_VERSION%

REM 3. Obtener actualizaciones desde GitHub
echo.
echo [*] Conectando con el repositorio en GitHub...
git fetch origin main
if %errorlevel% neq 0 goto :error_fetch

echo [*] Limpiando archivos locales y sincronizando con la ultima version...
git reset --hard origin/main
if %errorlevel% neq 0 goto :error_reset

REM 4. Actualizar dependencias de Node.js por si acaso
echo [*] Actualizando dependencias del proyecto (npm install)...
call npm install
if %errorlevel% neq 0 goto :error_npm

echo.
echo ========================================================================
echo   [OK] ¡APLICACION ACTUALIZADA EXITOSAMENTE A LA ULTIMA VERSION!
echo ========================================================================
echo   [*] Ya puedes iniciar el programa con INICIAR_ESP_STUDIO.bat
echo ========================================================================
echo.
pause
exit /b 0

:error_git_install
echo.
echo [X] ERROR: No se pudo completar la instalacion automatica de Git.
echo [!] Instale Git de forma manual desde: https://git-scm.com/
pause
exit /b 1

:error_fetch
echo.
echo [X] ERROR: No se pudo establecer conexion con el repositorio de GitHub.
echo [!] Verifique su conexion a internet y sus permisos de acceso.
pause
exit /b 1

:error_reset
echo.
echo [X] ERROR: Fallo la sincronizacion y limpieza de la version local.
pause
exit /b 1

:error_npm
echo.
echo [X] ERROR: No se pudieron instalar las dependencias con npm install.
pause
exit /b 1
