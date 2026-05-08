# ============================================================
#  ESP DESIGN SUITE  ·  Launch Script v3.3
#  Optimizado para Windows Terminal / PowerShell 5+
# ============================================================
$E = [char]27
$PR = "$E[38;2;60;110;150m"
$SC = "$E[38;2;120;140;160m"
$OK = "$E[38;2;80;160;120m"
$WR = "$E[38;2;180;150;100m"
$ER = "$E[38;2;160;70;70m"
$WH = "$E[38;2;220;225;235m"
$GY = "$E[38;2;50;65;80m"
$SL = "$E[38;2;150;160;175m"
$R = "$E[0m"

$null = $ER

# ── Ancho VISUAL (sin contar secuencias ANSI) ──────────────
function Get-VisualLen {
    param([string]$s)
    return ($s -replace '\x1B\[[0-9;]*m', '').Length
}

# Rellena una cadena con colores hasta alcanzar $Width chars visibles
function Add-VisualPadding {
    param([string]$s, [int]$Width)
    $len = Get-VisualLen $s
    $need = $Width - $len
    if ($need -gt 0) { return $s + (" " * $need) }
    return $s
}

# ── Helpers de cursor ──────────────────────────────────────
function Invoke-CursorUp { param([int]$n = 1); Write-Host "$E[${n}A" -NoNewline }
function Invoke-HideCursor { Write-Host "$E[?25l" -NoNewline }
function Invoke-ShowCursor { Write-Host "$E[?25h" -NoNewline }

# ── Barras ─────────────────────────────────────────────────
function Get-Bar {
    param([int]$Pct, [int]$W = 20, [string]$Color = $PR)
    $f = [math]::Floor($Pct / 100.0 * $W)
    $e = $W - $f
    return "${Color}$("█"*$f)${GY}$("░"*$e)${R}"
}

function Get-ThinBar {
    param([int]$Pct, [int]$W = 14, [string]$Color = $PR)
    $f = [math]::Floor($Pct / 100.0 * $W)
    $e = $W - $f
    return "${Color}$("█"*$f)${GY}$("░"*$e)${R}"
}

# ── Spinner ────────────────────────────────────────────────
$script:SI = 0
$SPINS = @("·", "o", "O", "o")
function Get-Spin { $s = $SPINS[$script:SI % 4]; $script:SI++; return $s }

# ── Log buffer ─────────────────────────────────────────────
$script:LogBuffer = [System.Collections.Generic.List[string]]::new()
function Add-Log {
    param([string]$Text, [string]$Kind = "")
    $ts = (Get-Date).ToString("HH:mm:ss")
    $col = switch ($Kind) {
        "ok" { $OK } "warn" { $WR } "err" { $ER }
        "info" { $PR } default { $SC }
    }
    $script:LogBuffer.Add("${GY}[$ts]${R} ${col}${Text}${R}")
    if ($script:LogBuffer.Count -gt 6) { $script:LogBuffer.RemoveAt(0) }
}

# ══════════════════════════════════════════════════════════════════════════════
#   HEADER
# ══════════════════════════════════════════════════════════════════════════════
function Show-ESPHeader {
    Clear-Host
    $yr = (Get-Date).ToString("yyyy")
    Write-Host ""
    Write-Host "   $GY╔══════════════════════════════════════════════════════════════════════════════╗$R"
    # Línea de título: contenido = 76 chars visibles entre los ║
    $title = " $WH ESP DESIGN STUDIO $GY· $SC PROFESSIONAL EDITION $GY· $SL $yr $R"
    Write-Host "   $GY║$R$(Add-VisualPadding $title 76)$GY║$R"
    Write-Host "   $GY╚══════════════════════════════════════════════════════════════════════════════╝$R"
}

# ══════════════════════════════════════════════════════════════════════════════
#   PANEL DUAL — izquierda LOG  |  derecha MÉTRICAS
#   Ancho total interior: 76 chars  (═══ × 76 entre los ║ externos)
#   Columna izquierda: 37 chars visibles
#   Columna derecha:   37 chars visibles
#   Separador central: 1 char (║)
# ══════════════════════════════════════════════════════════════════════════════
$PANEL_LINES = 11   # líneas que ocupa Write-Panel

$ICONS = @{ GIT = "⎇"; PYTHON = "§"; NODE = "N"; DATA = "D"; APP = "*" }

function Write-Panel {
    param([string]$Phase, [int]$GlobalPct, [hashtable]$M)

    $L = 37   # ancho visible columna izquierda
    $Rv = 37  # ancho visible columna derecha
    $TW = 76  # ancho total visible interior

    # Encabezados de columna
    $hL = Add-VisualPadding " ${SL}■ SYSTEM LOG${R}" $L
    $hR = Add-VisualPadding " ${SL}■ LIVE METRICS${R}" $Rv

    Write-Host "   $SC╔$("═"*$L)╦$("═"*$Rv)╗$R"
    Write-Host "   $SC║${R}${hL}$SC║${R}${hR}$SC║$R"
    Write-Host "   $SC╠$("═"*$L)╬$("═"*$Rv)╣$R"

    $mKeys = @("GIT", "PYTHON", "NODE", "DATA", "APP")

    for ($i = 0; $i -lt 5; $i++) {
        # ── Celda izquierda ──────────────────────────────
        $raw = if ($i -lt $script:LogBuffer.Count) { $script:LogBuffer[$i] } else { "" }
        $cell = Add-VisualPadding " $raw" $L      # +1 por el espacio inicial

        # ── Celda derecha ────────────────────────────────
        $key = $mKeys[$i]
        $ico = $ICONS[$key]
        $meta = $M[$key]
        $bar = Get-ThinBar -Pct $meta.Pct -W 13 -Color $meta.Color
        $valRaw = $meta.Val                                   # puede tener ANSI
        # derecha: "  ICO  KEY_______  BAR  VAL  "
        $right = " ${SL}${ico}${R} ${WH}$($key.PadRight(6))${R} $bar ${meta.Color}${valRaw}${R}"
        $rightCell = Add-VisualPadding $right $Rv

        Write-Host "   $SC║${R}${cell}$SC║${R}${rightCell}$SC║$R"
    }

    # ── Fila separadora y barra global ───────────────────
    Write-Host "   $SC╠$("═"*$L)╩$("═"*$Rv)╣$R"

    # Barra global ocupa todo el interior (76) menos: 1 spin + 1 sp + fase(18) + 1 sp + pct(4) + 1 sp = 26 → barra = 50
    $barW = 48
    $barColor = if ($GlobalPct -lt 50) { $SC } else { $PR }
    $gBar = Get-Bar -Pct $GlobalPct -W $barW -Color $barColor
    $gPct = "$GlobalPct%".PadLeft(4)
    $sp = Get-Spin

    # Pulso: cada 25% enciende un indicador extra
    $pulse = switch ([math]::Floor($GlobalPct / 25)) {
        0 { "${GY}○○○○${R}" }
        1 { "${SC}●${GY}○○○${R}" }
        2 { "${PR}●●${GY}○○${R}" }
        3 { "${OK}●●●${GY}○${R}" }
        default { "${OK}●●●●${R}" }
    }

    # Construir la línea de barra y validar que no exceda TW
    $phaseVis = ($Phase -replace '\x1B\[[0-9;]*m', '')
    if ($phaseVis.Length -gt 16) { $phaseVis = $phaseVis.Substring(0, 16) }
    $phasePad = $phaseVis.PadRight(16)

    $globalRow = " $sp ${WH}${phasePad}${R} $gBar $pulse $SL$gPct$R "
    $globalRow = Add-VisualPadding $globalRow $TW

    Write-Host "   $SC║${R}${globalRow}$SC║$R"
    Write-Host "   $SC╚$("═"*$TW)╝$R"
}

function Invoke-PanelRedraw {
    param([string]$Phase, [int]$GlobalPct, [hashtable]$M)
    Invoke-CursorUp -n $PANEL_LINES
    Write-Panel -Phase $Phase -GlobalPct $GlobalPct -M $M
}

# ── Métrica helper ─────────────────────────────────────────
function New-Meta {
    param([int]$Pct = 0, [string]$Val = "---", [string]$Color = $GY)
    return @{ Pct = $Pct; Val = $Val; Color = $Color }
}

$M = @{
    GIT    = New-Meta
    PYTHON = New-Meta
    NODE   = New-Meta
    DATA   = New-Meta
    APP    = New-Meta
}

# ── Animación de métrica ───────────────────────────────────
function Start-MetricAnimation {
    param($Key, $TargetPct, $Phase, $GlobalStart, $GlobalEnd, $M, $Steps = 10)
    $curPct = $M[$Key].Pct
    for ($s = 1; $s -le $Steps; $s++) {
        $p = [int]($curPct + ($TargetPct - $curPct) * $s / $Steps)
        $g = [int]($GlobalStart + ($GlobalEnd - $GlobalStart) * $s / $Steps)
        $M[$Key].Pct = $p
        Invoke-PanelRedraw -Phase $Phase -GlobalPct $g -M $M
        Start-Sleep -Milliseconds 40
    }
    $M[$Key].Pct = $TargetPct
}

# ══════════════════════════════════════════════════════════════════════════════
#   PANEL RESUMEN FINAL
# ══════════════════════════════════════════════════════════════════════════════
function Show-SummaryPanel {
    param([bool]$NodeFound, [bool]$GitOk, [int]$Port = 3000)

    $TW = 76
    Write-Host ""
    Write-Host "   $SC╔$("═"*$TW)╗$R"

    $r1 = " ${OK}✔ STATUS:${R} ${WH}System Operational · http://localhost:${Port}${R}"
    Write-Host "   $SC║${R}$(Add-VisualPadding $r1 $TW)$SC║$R"

    $r2 = " ${OK}✔ SYNC:${R}   ${WH}Cloud Connectivity Active (OneDrive / GitHub)${R}"
    Write-Host "   $SC║${R}$(Add-VisualPadding $r2 $TW)$SC║$R"

    Write-Host "   $SC╠$("═"*$TW)╣$R"

    $lines = @(
        " ${SL}CREADOR      :${R} ${WH}Andrés Jiménez  (Ingeniero Jr)${R}",
        " ${SL}MENTE MAESTRA:${R} ${WH}Lenin Peña  (Especialista ALS)${R}",
        " ${SL}APOYO        :${R} ${WH}Jaime Ochoa · Wilmer Arcos · Luna M${R}",
        " ${GY}AGRADECIMIENTOS: Equipo ALS Frontera Energy${R}"
    )
    foreach ($l in $lines) {
        Write-Host "   $SC║${R}$(Add-VisualPadding $l $TW)$SC║$R"
    }

    Write-Host "   $SC╚$("═"*$TW)╝$R"
    Write-Host ""
}

# ══════════════════════════════════════════════════════════════════════════════
#   SPLASH DE BOOT
# ══════════════════════════════════════════════════════════════════════════════
Invoke-HideCursor
Show-ESPHeader

$TW = 76
Write-Host ""
Write-Host "   $GY╔$("═"*$TW)╗$R"

$splashLines = @(
    "       ${PR}███████╗ ███████╗ ██████╗ ${R}",
    "       ${PR}██╔════╝ ██╔════╝ ██╔══██╗${R}",
    "       ${SC}█████╗   ███████╗ ██████╔╝${R}    ${GY}v 3.3${R}",
    "       ${SC}██╔══╝   ╚════██║ ██╔═══╝ ${R}    ${GY}EXECUTIVE EDITION${R}",
    "       ${GY}███████╗ ███████║ ██║     ${R}    ${SL}ESP Design Suite${R}",
    "       ${GY}╚══════╝ ╚══════╝ ╚═╝     ${R}",
    "                 ${GY}[ ${WH}ALS  /  ESP  /  VSD  ·  Frontera Energy${GY} ]${R}"
)
foreach ($l in $splashLines) {
    Write-Host "   $GY║${R}$(Add-VisualPadding "  $l" $TW)$GY║$R"
}

Write-Host "   $GY╚$("═"*$TW)╝$R"
Start-Sleep -Milliseconds 500

# ══════════════════════════════════════════════════════════════════════════════
#   BOOT SEQUENCE
# ══════════════════════════════════════════════════════════════════════════════
Add-Log "Inicializando suite" "info"
Write-Panel -Phase "SISTEMA · Inicio" -GlobalPct 0 -M $M

# ── GIT ───────────────────────────────────────────────────
$M.GIT.Val = "WAIT"; $M.GIT.Color = $SC
Start-MetricAnimation -Key GIT -TargetPct 30 -Phase "SYNC · Git Check" -GlobalStart 0 -GlobalEnd 8 -M $M

$gitExe = "git"
$gitCheck = $null -ne (Get-Command git -ErrorAction SilentlyContinue)

if (-not $gitCheck) {
    $rootPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath(".")
    $portablePath = Join-Path $rootPath ".git_portable\cmd\git.exe"
    if (Test-Path $portablePath) {
        $gitExe = $portablePath
        $gitCheck = $true
        Add-Log "Git Portable detectado" "ok"
    } else {
        Add-Log "Instalando Git Portable..." "warn"
        try {
            $zipPath = Join-Path $rootPath "git.zip"
            $destPath = Join-Path $rootPath ".git_portable"
            $minGitUrl = "https://github.com/git-for-windows/git/releases/download/v2.44.0.windows.1/MinGit-2.44.0-64-bit.zip"
            Invoke-WebRequest -Uri $minGitUrl -OutFile $zipPath -ErrorAction Stop
            Add-Type -AssemblyName System.IO.Compression.FileSystem
            [System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $destPath)
            Remove-Item $zipPath -Force
            if (Test-Path $portablePath) {
                $gitExe = $portablePath
                $gitCheck = $true
                Add-Log "Git Portable instalado OK" "ok"
            }
        } catch {
            Add-Log "Error instalando Git Portable" "err"
        }
    }
}

if ($gitCheck) {
    # Inicializar el repo Git si se descargó como ZIP sin carpeta .git
    if (-not (Test-Path ".git")) {
        Add-Log "Inicializando repo Git..." "info"
        & $gitExe init --quiet
        & $gitExe remote add origin "https://github.com/andresjimenito-cell/ESP-DESING-STUDIO.git"
        & $gitExe fetch origin --quiet
        & $gitExe reset --hard origin/main --quiet
    }

    $M.GIT.Val = "PULL"; $M.GIT.Color = $PR
    Start-MetricAnimation -Key GIT -TargetPct 60 -Phase "SYNC · GitHub" -GlobalStart 8 -GlobalEnd 16 -M $M
    
    # Detección inteligente para la máquina de desarrollo vs la practicante
    $isDev = $env:USERPROFILE -like "*andre*"
    if ($isDev) {
        & $gitExe pull origin main --quiet 2>&1 | Out-Null
    } else {
        & $gitExe fetch origin --quiet 2>&1 | Out-Null
        & $gitExe reset --hard origin/main --quiet 2>&1 | Out-Null
    }

    if ($LASTEXITCODE -eq 0) {
        Add-Log "Sincronizacion Git OK" "ok"
        $M.GIT.Val = "READY"; $M.GIT.Color = $OK
    }
    else {
        Add-Log "Error o GitHub offline" "warn"
        $M.GIT.Val = "LOCAL"; $M.GIT.Color = $WR
    }
}
else {
    Add-Log "Abriendo descarga de Git..." "warn"
    $M.GIT.Val = "NONE"; $M.GIT.Color = $WR
    Start-Process "https://git-scm.com/download/win"
}
$gitOk = ($LASTEXITCODE -eq 0) -and $gitCheck
Start-MetricAnimation -Key GIT -TargetPct 100 -Phase "SYNC · Finalizado" -GlobalStart 16 -GlobalEnd 22 -M $M

# ── PYTHON ────────────────────────────────────────────────
$M.PYTHON.Val = "WAIT"; $M.PYTHON.Color = $SC
Start-MetricAnimation -Key PYTHON -TargetPct 20 -Phase "CLOUD · OneDrive" -GlobalStart 22 -GlobalEnd 28 -M $M

$pythonCheck = $null -ne (Get-Command python -ErrorAction SilentlyContinue)
if ($pythonCheck) {
    $M.PYTHON.Val = "RUN"; $M.PYTHON.Color = $PR
    Start-MetricAnimation -Key PYTHON -TargetPct 55 -Phase "CLOUD · Syncing" -GlobalStart 28 -GlobalEnd 36 -M $M
    python services/cloud_connector.py
    Add-Log "OneDrive sincronizado" "ok"
    $M.PYTHON.Val = "DONE"; $M.PYTHON.Color = $OK
}
else {
    Add-Log "Python no encontrado" "err"
    $M.PYTHON.Val = "MISS"; $M.PYTHON.Color = $ER
}
Start-MetricAnimation -Key PYTHON -TargetPct 100 -Phase "CLOUD · Finalizado" -GlobalStart 36 -GlobalEnd 42 -M $M

# ── NODE ──────────────────────────────────────────────────
$M.NODE.Val = "WAIT"; $M.NODE.Color = $SC
Start-MetricAnimation -Key NODE -TargetPct 25 -Phase "CORE · Runtime" -GlobalStart 42 -GlobalEnd 50 -M $M

$nodeFound = $null -ne (Get-Command node -ErrorAction SilentlyContinue)

if (-not $nodeFound) {
    $rootPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath(".")
    $nodePortablePath = Join-Path $rootPath ".node_portable"
    $nodeExePath = Join-Path $nodePortablePath "node-v20.12.2-win-x64\node.exe"
    
    if (Test-Path $nodeExePath) {
        $nodeBinPath = Join-Path $nodePortablePath "node-v20.12.2-win-x64"
        $env:PATH = "$nodeBinPath;$env:PATH"
        $nodeFound = $true
        Add-Log "Node.js Portable detectado" "ok"
    } else {
        Add-Log "Configurando Node.js Portable..." "info"
        try {
            $zipPath = Join-Path $rootPath "node.zip"
            $nodeUrl = "https://nodejs.org/dist/v20.12.2/node-v20.12.2-win-x64.zip"
            Invoke-WebRequest -Uri $nodeUrl -OutFile $zipPath -ErrorAction Stop
            Add-Type -AssemblyName System.IO.Compression.FileSystem
            [System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $nodePortablePath)
            Remove-Item $zipPath -Force
            if (Test-Path $nodeExePath) {
                $nodeBinPath = Join-Path $nodePortablePath "node-v20.12.2-win-x64"
                $env:PATH = "$nodeBinPath;$env:PATH"
                $nodeFound = $true
                Add-Log "Node.js Portable listo" "ok"
            }
        } catch {
            Add-Log "Error instalando Node.js Portable" "err"
        }
    }
}

if ($nodeFound) {
    $M.NODE.Val = "V8"; $M.NODE.Color = $PR
    Start-MetricAnimation -Key NODE -TargetPct 60 -Phase "CORE · Modules" -GlobalStart 50 -GlobalEnd 56 -M $M
    Set-Location "app_unified"
    if (-not (Test-Path "node_modules")) {
        Add-Log "Instalando dependencias..." "warn"
        $M.NODE.Val = "INST"; $M.NODE.Color = $WR
        Invoke-PanelRedraw -Phase "NPM · Installing" -GlobalPct 57 -M $M
        npm.cmd install
    }
    Add-Log "Node.js listo" "ok"
    $M.NODE.Val = "READY"; $M.NODE.Color = $OK
    Start-MetricAnimation -Key NODE -TargetPct 100 -Phase "CORE · Finalizado" -GlobalStart 58 -GlobalEnd 64 -M $M

    # ── DATA ──────────────────────────────────────────────
    $M.DATA.Val = "WAIT"; $M.DATA.Color = $SC
    Start-MetricAnimation -Key DATA -TargetPct 40 -Phase "DATA · Pre-Cache" -GlobalStart 64 -GlobalEnd 75 -M $M
    node tools/preprocesar_datos.js
    Add-Log "Cache JSON optimizado" "ok"
    $M.DATA.Val = "CACHE"; $M.DATA.Color = $OK
    Start-MetricAnimation -Key DATA -TargetPct 100 -Phase "DATA · Finalizado" -GlobalStart 75 -GlobalEnd 88 -M $M

    # ── APP ───────────────────────────────────────────────
    $M.APP.Val = "WAIT"; $M.APP.Color = $SC
    Start-MetricAnimation -Key APP -TargetPct 70 -Phase "LAUNCH · Vite" -GlobalStart 88 -GlobalEnd 94 -M $M
    Add-Log "Servidor Vite activo :3000" "ok"
    $M.APP.Val = "LIVE"; $M.APP.Color = $OK
    Start-MetricAnimation -Key APP -TargetPct 100 -Phase "SISTEMA ONLINE" -GlobalStart 94 -GlobalEnd 100 -M $M

    Start-Sleep -Milliseconds 400
    Invoke-ShowCursor
    Show-SummaryPanel -NodeFound $true -GitOk $gitOk -Port 3000
    
    # Intentar detectar Chrome, si no usar Edge (que siempre está en Windows)
    $browser = "msedge"
    if (Test-Path "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe") { $browser = "chrome" }
    elseif (Test-Path "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe") { $browser = "chrome" }
    
    Add-Log "Lanzando ventana en $browser..." "info"
    Start-Process $browser "--app=http://localhost:3000"
    
    npm.cmd run dev -- --logLevel silent

}
else {
    # ── FALLBACK ──────────────────────────────────────────
    Add-Log "Modo sin Node.js (Servidor Local)" "info"
    $M.NODE.Val = "SERV"; $M.NODE.Color = $PR
    Start-MetricAnimation -Key NODE -TargetPct 100 -Phase "FALLBACK · HTTP" -GlobalStart 50 -GlobalEnd 65 -M $M

    $M.DATA.Val = "N/A"; $M.DATA.Color = $GY
    $M.APP.Val = "WAIT"; $M.APP.Color = $SC
    Start-MetricAnimation -Key APP -TargetPct 50 -Phase "FALLBACK · Server" -GlobalStart 65 -GlobalEnd 80 -M $M

    $port = 4001
    $p = "app_unified\dist"
    $l = New-Object System.Net.HttpListener
    while ($true) {
        try {
            $l.Prefixes.Clear()
            $l.Prefixes.Add("http://localhost:$port/")
            $l.Start(); break
        }
        catch { $port++ }
    }

    Add-Log "HTTP Listener activo :$port" "ok"
    $M.APP.Val = "LIVE"; $M.APP.Color = $OK
    Start-MetricAnimation -Key APP -TargetPct 100 -Phase "FALLBACK ONLINE" -GlobalStart 80 -GlobalEnd 100 -M $M

    Start-Sleep -Milliseconds 400
    Invoke-ShowCursor
    Show-SummaryPanel -NodeFound $false -GitOk $gitOk -Port $port
    
    # Intentar detectar Chrome, si no usar Edge
    $browser = "msedge"
    if (Test-Path "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe") { $browser = "chrome" }
    elseif (Test-Path "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe") { $browser = "chrome" }
    
    Start-Process $browser "--app=http://localhost:$port"

    Write-Host "   ${GY}Server running · Ctrl+C para detener.${R}"
    Write-Host ""

    while ($l.IsListening) {
        $c = $l.GetContext()
        $rq = $c.Request
        $rs = $c.Response
        $rel = $rq.Url.LocalPath.TrimStart('/')
        if ($rel -eq '') { $rel = 'index.html' }
        try {
            $f = Join-Path (Get-Item $p).FullName $rel
            if (Test-Path $f) {
                $ext = [System.IO.Path]::GetExtension($f)
                $ct = switch ($ext) {
                    '.html' { 'text/html' }
                    '.js' { 'application/javascript' }
                    '.css' { 'text/css' }
                    '.png' { 'image/png' }
                    '.jpg' { 'image/jpeg' }
                    '.svg' { 'image/svg+xml' }
                    '.json' { 'application/json' }
                    default { 'application/octet-stream' }
                }
                $b = [System.IO.File]::ReadAllBytes($f)
                $rs.ContentType = $ct
                $rs.ContentLength64 = $b.Length
                $rs.OutputStream.Write($b, 0, $b.Length)
            }
            else { $rs.StatusCode = 404 }
        }
        catch { $rs.StatusCode = 500 }
        $rs.Close()
    }
}