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

echo [*] Directorio de trabajo establecido: %CD%

REM 2. Verificar si Git esta instalado
echo [*] Verificando si Git esta instalado en el sistema...
git --version >nul 2>&1
if %errorlevel% equ 0 goto :git_ready

REM 2.1 Verificar si ya existe una version portatil local de Git
echo [*] Buscando version portatil local de Git...
if not exist "%~dp0git-portable\cmd\git.exe" goto :download_portable_git
set "PATH=%~dp0git-portable\cmd;%PATH%"
goto :git_ready_check

:download_portable_git
echo.
echo [!] ADVERTENCIA: Git no esta instalado en este sistema.
echo [*] Intentando descargar e instalar la version PORTATIL de Git (no requiere privilegios de administrador)...
echo [*] Descargando MinGit desde GitHub...

set "GIT_ZIP_URL=https://github.com/git-for-windows/git/releases/download/v2.43.0.windows.1/MinGit-2.43.0-64-bit.zip"
set "GIT_ZIP_FILE=%temp%\git-portable.zip"
set "GIT_PORTABLE_DIR=%~dp0git-portable"

if not exist "%GIT_PORTABLE_DIR%" mkdir "%GIT_PORTABLE_DIR%"

powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Write-Host 'Descargando Git portatil...'; Invoke-WebRequest -Uri '%GIT_ZIP_URL%' -OutFile '%GIT_ZIP_FILE%'"
if %errorlevel% neq 0 goto :error_download_git

echo [*] Extrayendo archivos...
powershell -Command "Write-Host 'Extrayendo...'; Expand-Archive -Path '%GIT_ZIP_FILE%' -DestinationPath '%GIT_PORTABLE_DIR%' -Force"
if %errorlevel% neq 0 goto :error_extract_git

del "%GIT_ZIP_FILE%" >nul 2>&1
set "PATH=%~dp0git-portable\cmd;%PATH%"
echo [OK] Git portatil configurado correctamente.
goto :git_ready_check

:git_ready_check
git --version >nul 2>&1
if %errorlevel% equ 0 goto :git_ready

:error_download_git
echo.
echo [X] ERROR: No se pudo descargar Git automaticamente (posible bloqueo de red o falta de internet).
goto :manual_git_instructions

:error_extract_git
echo.
echo [X] ERROR: Fallo al extraer el archivo zip de Git portatil.
goto :manual_git_instructions

:manual_git_instructions
echo.
echo =======================================================================
echo   INSTRUCCIONES PARA INSTALACION MANUAL SIN PERMISOS DE ADMINISTRADOR:
echo =======================================================================
echo   1. Descargue el archivo ZIP de MinGit desde este enlace:
echo      https://github.com/git-for-windows/git/releases/download/v2.43.0.windows.1/MinGit-2.43.0-64-bit.zip
echo.
echo   2. Cree una carpeta llamada "git-portable" en este mismo directorio:
echo      %~dp0git-portable
echo.
echo   3. Extraiga el contenido del ZIP dentro de la carpeta "git-portable".
echo      Debe quedar la estructura:
echo      %~dp0git-portable\cmd\git.exe
echo.
echo   4. Vuelva a iniciar este archivo BAT.
echo =======================================================================
echo.
pause
exit /b 1

:git_ready
for /f "tokens=*" %%i in ('git --version') do set GIT_VERSION=%%i
echo [OK] Git disponible: %GIT_VERSION%

REM 2.5 Verificar si Node.js esta instalado
echo [*] Verificando si Node.js esta instalado en el sistema...
node --version >nul 2>&1
if %errorlevel% equ 0 goto :node_ready

REM 2.6 Verificar si ya existe una version portatil local de Node
echo [*] Buscando version portatil local de Node.js...
if not exist "%~dp0node-portable\node-v20.11.1-win-x64\node.exe" goto :download_portable_node
set "PATH=%~dp0node-portable\node-v20.11.1-win-x64;%PATH%"
goto :node_ready_check

:download_portable_node
echo.
echo [!] ADVERTENCIA: Node.js no esta instalado en este sistema.
echo [*] Intentando descargar e instalar la version PORTATIL de Node.js (no requiere privilegios de administrador)...
echo [*] Descargando desde nodejs.org (LTS)...

set "NODE_ZIP_URL=https://nodejs.org/dist/v20.11.1/node-v20.11.1-win-x64.zip"
set "NODE_ZIP_FILE=%temp%\node-portable.zip"
set "NODE_PORTABLE_DIR=%~dp0node-portable"

if not exist "%NODE_PORTABLE_DIR%" mkdir "%NODE_PORTABLE_DIR%"

powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Write-Host 'Descargando Node.js portatil...'; Invoke-WebRequest -Uri '%NODE_ZIP_URL%' -OutFile '%NODE_ZIP_FILE%'"
if %errorlevel% neq 0 goto :error_download_node

echo [*] Extrayendo archivos...
powershell -Command "Write-Host 'Extrayendo...'; Expand-Archive -Path '%NODE_ZIP_FILE%' -DestinationPath '%NODE_PORTABLE_DIR%' -Force"
if %errorlevel% neq 0 goto :error_extract_node

del "%NODE_ZIP_FILE%" >nul 2>&1
set "PATH=%~dp0node-portable\node-v20.11.1-win-x64;%PATH%"
echo [OK] Node.js portatil configurado correctamente.
goto :node_ready_check

:node_ready_check
node --version >nul 2>&1
if %errorlevel% equ 0 goto :node_ready

:error_download_node
echo.
echo [X] ERROR: No se pudo descargar Node.js automaticamente (posible bloqueo de red o falta de internet).
goto :manual_node_instructions

:error_extract_node
echo.
echo [X] ERROR: Fallo al extraer el archivo zip de Node.js portatil.
goto :manual_node_instructions

:manual_node_instructions
echo.
echo =======================================================================
echo   INSTRUCCIONES PARA INSTALACION MANUAL SIN PERMISOS DE ADMINISTRADOR:
echo =======================================================================
echo   1. Descargue el archivo ZIP oficial de Node.js desde este enlace:
echo      https://nodejs.org/dist/v20.11.1/node-v20.11.1-win-x64.zip
echo.
echo   2. Cree una carpeta llamada "node-portable" en este mismo directorio:
echo      %~dp0node-portable
echo.
echo   3. Extraiga el contenido del ZIP dentro de la carpeta "node-portable".
echo      Debe quedar la estructura:
echo      %~dp0node-portable\node-v20.11.1-win-x64\node.exe
echo.
echo   4. Vuelva a iniciar este archivo BAT.
echo =======================================================================
echo.
pause
exit /b 1

:node_ready
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo [OK] Node.js disponible: %NODE_VERSION%

REM 3. Obtener actualizaciones desde GitHub
echo.
echo [*] Verificando repositorio local de Git...

REM Si no existe la carpeta .git en el directorio actual (la raiz)
if not exist ".git" (
    echo [!] Repositorio Git no inicializado en la carpeta principal.
    echo [*] Inicializando repositorio Git de forma automatica...
    git init
    git remote add origin https://github.com/andresjimenito-cell/ESP-DESING-STUDIO.git
)

:git_repo_ok
echo [*] Conectando con el repositorio en GitHub...
REM Asegurar que la URL del remoto origin sea la correcta
git remote set-url origin https://github.com/andresjimenito-cell/ESP-DESING-STUDIO.git >nul 2>&1

git fetch origin main
if %errorlevel% neq 0 goto :error_fetch

echo [*] Limpiando archivos locales y sincronizando con la ultima version...
git reset --hard origin/main
if %errorlevel% neq 0 goto :error_reset

REM Configurar rama local principal
git branch -M main >nul 2>&1
git branch --set-upstream-to=origin/main main >nul 2>&1

REM 4. Actualizar dependencias de Node.js por si acaso
echo [*] Actualizando dependencias del proyecto (npm install)...
cd /d "%~dp0ESP DESING ESTUDIO"
call npm install
cd /d "%~dp0"
if %errorlevel% neq 0 goto :error_npm

echo.
echo ========================================================================
echo   [OK] ?APLICACION ACTUALIZADA EXITOSAMENTE A LA ULTIMA VERSION!
echo ========================================================================
echo   [*] Ya puedes iniciar el programa con ??? INICIAR_ESP_STUDIO.bat
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

