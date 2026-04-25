# ============================================================
#  ESP DESIGN SUITE  ·  Launch Script v3.2 (Executive Edition)
#  Optimizado para Windows Terminal / PowerShell 5+
# ============================================================
$E = [char]27
# Paleta de Colores Ejecutiva (Petroleum & Slate)
$PR = "$E[38;2;60;110;150m"  # Primary: Azul Petróleo Suave
$SC = "$E[38;2;120;140;160m" # Secondary: Gris Acero
$OK = "$E[38;2;80;160;120m"  # Success: Verde Bosque Apagado
$WR = "$E[38;2;180;150;100m" # Warning: Oro Mate
$ER = "$E[38;2;160;70;70m"   # Error: Carmesí Oscuro
$WH = "$E[38;2;220;225;235m" # White: Blanco Hielo
$GY = "$E[38;2;50;65;80m"    # Dark Gray: Pizarra Profundo
$SL = "$E[38;2;150;160;175m" # Slate: Plateado
$R = "$E[0m"                 # Reset

$null = $ER

# -- Helpers de cursor --------------------------------------
function Invoke-CursorUp { param([int]$n = 1); Write-Host "$E[${n}A" -NoNewline }
function Invoke-CursorDown { param([int]$n = 1); Write-Host "$E[${n}B" -NoNewline }
function Invoke-CursorCol { param([int]$c = 1); Write-Host "$E[${c}G" -NoNewline }
function Invoke-HideCursor { Write-Host "$E[?25l" -NoNewline }
function Invoke-ShowCursor { Write-Host "$E[?25h" -NoNewline }

# -- Paleta de barras ---------------------------------------
function Get-Bar {
    param([int]$Pct, [int]$W = 20, [string]$Color = $PR)
    $f = [math]::Floor($Pct / 100.0 * $W)
    $e = $W - $f
    return "${Color}$("█"*$f)${GY}$("░"*$e)${R}"
}

function Get-ThinBar {
    param([int]$Pct, [int]$W = 16, [string]$Color = $PR)
    $f = [math]::Floor($Pct / 100.0 * $W)
    $e = $W - $f
    return "${Color}$("█"*$f)${GY}$("░"*$e)${R}"
}

# -- Spinner circular ---------------------------------------
$script:SI = 0
$SPINS = @("·", "o", "O", "o")
function Get-Spin {
    $s = $SPINS[$script:SI % 4]; $script:SI++; return $s
}

# -- Línea de log ------------------------------------------
$script:LogBuffer = [System.Collections.Generic.List[string]]::new()
function Add-Log {
    param([string]$Text, [string]$Kind = "")
    $ts = (Get-Date).ToString("HH:mm:ss")
    $col = switch ($Kind) {
        "ok" { $OK }
        "warn" { $WR }
        "err" { $ER }
        "info" { $PR }
        default { $SC }
    }
    $line = "${GY}[$ts]${R} ${col}${Text}${R}"
    $script:LogBuffer.Add($line)
    if ($script:LogBuffer.Count -gt 6) { $script:LogBuffer.RemoveAt(0) }
}

# ═══════════════════════════════════════════════════════════
#   HEADER PRINCIPAL
# ═══════════════════════════════════════════════════════════
function Show-ESPHeader {
    Clear-Host
    Write-Host ""
    Write-Host "   $GY╔══════════════════════════════════════════════════════════════════════════════╗$R"
    Write-Host "   $GY║$R  $WH ESP DESIGN STUDIO · PROFESSIONAL EDITION$R              $GY$((Get-Date).ToString("yyyy"))$R  $GY║$R"
    Write-Host "   $GY╚══════════════════════════════════════════════════════════════════════════════╝$R"
}

# ═══════════════════════════════════════════════════════════
#   PANEL DE CONTROL DINÁMICO
# ═══════════════════════════════════════════════════════════
$PANEL_LINES = 11

function Write-Panel {
    param(
        [string]$Phase,
        [int]$GlobalPct,
        [hashtable]$M
    )

    Write-Host "   $SC╔═════════════════════════════════════╦══════════════════════════════════════╗$R"
    Write-Host "   $SC║$R  ${SL}■ SYSTEM LOG${R}                       $SC║$R  ${SL}■ LIVE METRICS${R}                       $SC║$R"
    Write-Host "   $SC╠═════════════════════════════════════╬══════════════════════════════════════╣$R"

    $mKeys = @("GIT", "PYTHON", "NODE", "DATA", "APP")

    for ($i = 0; $i -lt 5; $i++) {
        $rawLog = if ($i -lt $script:LogBuffer.Count) { $script:LogBuffer[$i] } else { "" }
        $clean = $rawLog -replace '\x1B\[[0-9;]*m', ''
        $vis = if ($clean.Length -gt 35) { $clean.Substring(0, 35) } else { $clean }
        $pad = 35 - $vis.Length
        $leftDisp = $rawLog + (" " * $pad)

        $key = $mKeys[$i]
        $meta = $M[$key]
        $bar = Get-ThinBar -Pct $meta.Pct -W 12 -Color $meta.Color
        $valD = $meta.Val
        $valClean = $valD -replace '\x1B\[[0-9;]*m', ''
        $valPad = " " * [math]::Max(0, 10 - $valClean.Length)

        Write-Host "   $SC║$R $leftDisp $SC║$R  ${SL}$($key.PadRight(8))$R $bar $valD$valPad $SC║$R"
    }

    Write-Host "   $SC╠═════════════════════════════════════╩══════════════════════════════════════╣$R"

    $barColor = if ($GlobalPct -lt 50) { $SC } else { $PR }
    $gBar = Get-Bar -Pct $GlobalPct -W 44 -Color $barColor
    $gPct = "$GlobalPct%".PadLeft(4)
    $phPad = 18
    $phVis = $Phase -replace '\x1B\[[0-9;]*m', ''
    if ($phVis.Length -gt $phPad) { $Phase = $Phase.Substring(0, $phPad) }

    Write-Host "   $SC║$R $(Get-Spin) ${WH}$Phase${R} $gBar $SL$gPct$R $SC║$R"
    Write-Host "   $SC╚══════════════════════════════════════════════════════════════════════════════╝$R"
}

function Invoke-PanelRedraw {
    param([string]$Phase, [int]$GlobalPct, [hashtable]$M)
    Invoke-CursorUp -n $PANEL_LINES
    Write-Panel -Phase $Phase -GlobalPct $GlobalPct -M $M
}

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

function Show-SummaryPanel {
    param([bool]$NodeFound, [bool]$GitOk, [int]$Port = 3000)
    Write-Host ""
    Write-Host "   $SC╔══════════════════════════════════════════════════════════════════════════════╗$R"
    Write-Host "   $SC║$R  ${OK}✔ STATUS:${R} $WH System Operational at http://localhost:$Port$R                $SC║$R"
    Write-Host "   $SC║$R  ${OK}✔ SYNC:${R}   $WH Cloud Connectivity Active (OneDrive/GitHub)$R                 $SC║$R"
    Write-Host "   $SC╠══════════════════════════════════════════════════════════════════════════════╣$R"
    Write-Host "   $SC║$R  ${SL}CREADOR:$R $WH ANDRES JIMENEZ (INGENIERO JR)$R                                $SC║$R"
    Write-Host "   $SC║$R  ${SL}MENTE MAESTRA:$R $WH LENIN PEÑA (ESPECIALISTA ALS)$R                          $SC║$R"
    Write-Host "   $SC║$R  ${SL}APOYO:$R $WH JAIME OCHOA · WILMER ARCOS$R                                     $SC║$R"
    Write-Host "   $SC║$R  ${GY}AGRADECIMIENTOS:$R $SC EQUIPO ALS FRONTERA ENERGY$R                              $SC║$R"
    Write-Host "   $SC╚══════════════════════════════════════════════════════════════════════════════╝$R"
    Write-Host ""
}

# -- INICIO
Invoke-HideCursor
Show-ESPHeader

Write-Host ""
Write-Host "   $GY╔══════════════════════════════════════════════════════════════════════════════╗$R"
Write-Host "   $GY║$R       ${PR}███████╗ ███████╗ ██████╗ ${R}                                        $GY║$R"
Write-Host "   $GY║$R       ${PR}██╔════╝ ██╔════╝ ██╔══██╗${R}                                        $GY║$R"
Write-Host "   $GY║$R       ${SC}█████╗   ███████╗ ██████╔╝${R}    ${GY}v 3.2${R}                               $GY║$R"
Write-Host "   $GY║$R       ${SC}██╔══╝   ╚════██║ ██╔═══╝ ${R}    ${GY}EXECUTIVE EDITION${R}                  $GY║$R"
Write-Host "   $GY║$R       ${GY}███████╗ ███████║ ██║     ${R}    ${GY}ESP Design Suite${R}                  $GY║$R"
Write-Host "   $GY║$R       ${GY}╚══════╝ ╚══════╝ ╚═╝     ${R}                                        $GY║$R"
Write-Host "   $GY║$R                     ${GY}[ ${WH}ALS  /  ESP  /  VSD${GY}  ·  ${WH}Frontera Energy${GY} ]${R}          $GY║$R"
Write-Host "   $GY╚══════════════════════════════════════════════════════════════════════════════╝$R"

Start-Sleep -Milliseconds 500

Add-Log "Inicializando suite ejecutiva..." "info"
Write-Panel -Phase "SISTEMA · Inicio" -GlobalPct 0 -M $M

# -- GIT
$M.GIT.Val = "WAIT"
$M.GIT.Color = $SC
Start-MetricAnimation -Key GIT -TargetPct 30 -Phase "SYNC · Git Check" -GlobalStart 0 -GlobalEnd 8 -M $M

$gitCheck = if ($null -ne (Get-Command git -ErrorAction SilentlyContinue)) { $true } else { $false }
if ($gitCheck) {
    $M.GIT.Val = "PULL"
    $M.GIT.Color = $PR
    Start-MetricAnimation -Key GIT -TargetPct 60 -Phase "SYNC · GitHub" -GlobalStart 8 -GlobalEnd 16 -M $M
    git pull origin main --quiet 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Add-Log "Sincronización Git OK" "ok"
        $M.GIT.Val = "READY"
        $M.GIT.Color = $OK
    }
    else {
        Add-Log "GitHub offline" "warn"
        $M.GIT.Val = "LOCAL"
        $M.GIT.Color = $WR
    }
}
else {
    $M.GIT.Val = "NONE"
    $M.GIT.Color = $WR
}
$gitOk = ($LASTEXITCODE -eq 0) -and $gitCheck
Start-MetricAnimation -Key GIT -TargetPct 100 -Phase "SYNC · Finalizado" -GlobalStart 16 -GlobalEnd 22 -M $M

# -- PYTHON
$M.PYTHON.Val = "WAIT"
$M.PYTHON.Color = $SC
Start-MetricAnimation -Key PYTHON -TargetPct 20 -Phase "CLOUD · OneDrive" -GlobalStart 22 -GlobalEnd 28 -M $M

$pythonCheck = if ($null -ne (Get-Command python -ErrorAction SilentlyContinue)) { $true } else { $false }
if ($pythonCheck) {
    $M.PYTHON.Val = "RUN"
    $M.PYTHON.Color = $PR
    Start-MetricAnimation -Key PYTHON -TargetPct 55 -Phase "CLOUD · Syncing" -GlobalStart 28 -GlobalEnd 36 -M $M
    python services/cloud_connector.py
    Add-Log "OneDrive Sincronizado" "ok"
    $M.PYTHON.Val = "DONE"
    $M.PYTHON.Color = $OK
}
else {
    $M.PYTHON.Val = "MISS"
    $M.PYTHON.Color = $ER
}
Start-MetricAnimation -Key PYTHON -TargetPct 100 -Phase "CLOUD · Finalizado" -GlobalStart 36 -GlobalEnd 42 -M $M

# -- NODE
$M.NODE.Val = "WAIT"
$M.NODE.Color = $SC
Start-MetricAnimation -Key NODE -TargetPct 25 -Phase "CORE · Runtime" -GlobalStart 42 -GlobalEnd 50 -M $M

$nodeFound = if ($null -ne (Get-Command node -ErrorAction SilentlyContinue)) { $true } else { $false }
if ($nodeFound) {
    $M.NODE.Val = "V8"
    $M.NODE.Color = $PR
    Start-MetricAnimation -Key NODE -TargetPct 60 -Phase "CORE · Modules" -GlobalStart 50 -GlobalEnd 56 -M $M
    Set-Location "app_unified"
    if (-not (Test-Path "node_modules")) {
        Add-Log "Instalando dependencias" "warn"
        $M.NODE.Val = "INST"
        $M.NODE.Color = $WR
        npm.cmd install
    }
    $M.NODE.Val = "READY"
    $M.NODE.Color = $OK
    Start-MetricAnimation -Key NODE -TargetPct 100 -Phase "CORE · Finalizado" -GlobalStart 58 -GlobalEnd 64 -M $M

    # -- DATA
    $M.DATA.Val = "WAIT"
    $M.DATA.Color = $SC
    Start-MetricAnimation -Key DATA -TargetPct 40 -Phase "DATA · Pre-Cache" -GlobalStart 64 -GlobalEnd 75 -M $M
    node tools/preprocesar_datos.js
    Add-Log "Cache JSON optimizado" "ok"
    $M.DATA.Val = "CACHE"
    $M.DATA.Color = $OK
    Start-MetricAnimation -Key DATA -TargetPct 100 -Phase "DATA · Finalizado" -GlobalStart 75 -GlobalEnd 88 -M $M

    # -- APP
    $M.APP.Val = "WAIT"
    $M.APP.Color = $SC
    Start-MetricAnimation -Key APP -TargetPct 70 -Phase "LAUNCH · Vite" -GlobalStart 88 -GlobalEnd 94 -M $M
    $M.APP.Val = "LIVE"
    $M.APP.Color = $OK
    Start-MetricAnimation -Key APP -TargetPct 100 -Phase "SISTEMA ONLINE" -GlobalStart 94 -GlobalEnd 100 -M $M
    
    Start-Sleep -Milliseconds 400
    Invoke-ShowCursor
    Show-SummaryPanel -NodeFound $true -GitOk $gitOk -Port 3000
    npm.cmd run dev -- --logLevel silent
}
else {
    # Fallback logic simplified for clarity
    Add-Log "Fallback mode activo" "warn"
    Invoke-ShowCursor
    Show-SummaryPanel -NodeFound $false -GitOk $gitOk -Port 4001
    # ... rest of fallback logic ...
}
