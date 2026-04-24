$E = [char]27
$CY = "$E[38;2;0;215;215m"
$AM = "$E[38;2;255;180;0m"
$GR = "$E[38;2;0;215;120m"
$OR = "$E[38;2;255;130;20m"
$RE = "$E[38;2;255;70;70m"
$YE = "$E[38;2;255;215;50m"
$TL = "$E[38;2;0;200;175m"
$WH = "$E[38;2;210;225;245m"
$GY = "$E[38;2;70;90;120m"
$R = "$E[0m"

function Show-ESPHeader {
    Clear-Host
    Write-Host ""
    Write-Host "   $CY╔════════════════════════════════════════════════════════════════════════╗$R"
    Write-Host "   $CY║$R                                                                        $CY║$R"
    Write-Host "   $CY║$R$OR     |>==<|  $AM   ███████╗ ███████╗ ██████╗ $R                              $CY║$R"
    Write-Host "   $CY║$R$OR     |    |  $AM   ██╔════╝ ██╔════╝ ██╔══██╗$R                              $CY║$R"
    Write-Host "   $CY║$R$OR    /======\ $AM   █████╗   ███████╗ ██████╔╝$R   $WH D E S I G N$R               $CY║$R"
    Write-Host "   $CY║$R$OR    |░░░░░░| $AM   ██╔══╝   ╚════██║ ██╔═══╝ $R                              $CY║$R"
    Write-Host "   $CY║$R$OR    |▒▒▒▒▒▒| $AM   ███████╗ ██████╔╝ ██║$R   $GY Analysis Suite$R                 $CY║$R"
    Write-Host "   $CY║$R$OR    |██████| $AM   ╚══════╝ ╚═════╝  ╚═╝$R                                   $CY║$R"
    Write-Host "   $CY║$R$OR    \======/ $GY  ──────────────────────────────────────────────────$R       $CY║$R"
    Write-Host "   $CY║$R$OR     |    |  $TL  Electrical Submersible Pump $GY·$OR Production Opt.$R            $CY║$R"
    Write-Host "   $CY║$R$OR     |>==<|  $R                                                           $CY║$R"
    Write-Host "   $CY║$R                                                                        $CY║$R"
    Write-Host "   $CY║$R    $GY Autores:$R $WH Lenin Peña (Especialista ALS)$R                          $CY║$R"
    Write-Host "   $CY║$R    $GY          $R $WH Andrés Jiménez (Ing Junior)$R                           $CY║$R"
    Write-Host "   $CY║$R    $GY Apoyo  :$R $OR Equipo ALS Frontera Energy$R                             $CY║$R"
    Write-Host "   $CY║$R                                                                        $CY║$R"
    Write-Host "   $CY║$R              $GY▓▓▓▓▒▒▒▒░░░░$R$YE  ALS  /  ESP  /  VSD  $R$GY░░░░▒▒▒▒▓▓▓▓$R           $CY║$R"
    Write-Host "   $CY║$R                                                                        $CY║$R"
    Write-Host "   $CY╚════════════════════════════════════════════════════════════════════════╝$R"
}

$null = $RE 

Show-ESPHeader
Write-Host "   $CY╔════════════════════════════════════════════════════════════════════════╗$R"
Write-Host "   $CY║$R      $GY[$AM BOOT $GY]$WH Initializing Cloud Data Sync Engine . . . $R         $CY║$R"
Write-Host "   $CY║$R                                                                        $CY║$R"

# --- NUEVA LÓGICA DE AUTO-ACTUALIZACIÓN ---
$gitCheck = Get-Command git -ErrorAction SilentlyContinue
if ($gitCheck) {
    Write-Host "   $CY║$R      $GY[$TL SYNC $GY]$WH Checking for updates on GitHub . . .$R               $CY║$R"
    $updateResult = git pull origin main --quiet 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   $CY║$R      $GY[$GR  OK  $GY]$WH System is up to date$R                               $CY║$R"
    } else {
        Write-Host "   $CY║$R      $GY[$OR SKIP $GY]$WH Offline or Sync busy - Starting local version$R       $CY║$R"
    }
} else {
    Write-Host "   $CY║$R      $GY[$YE WARN $GY]$WH Git not found - Auto-updates disabled$R               $CY║$R"
}
Write-Host "   $CY║$R                                                                        $CY║$R"

# Sincronización automática desde OneDrive (Python maneja su propio dibujo de 'cuerpo' de la caja)
$pythonCheck = Get-Command python -ErrorAction SilentlyContinue
if ($pythonCheck) {
    python services/cloud_connector.py
}
else {
    Write-Host "   $CY║$R      $RE[ ERROR ]$WH Python environment not detected.$R                     $CY║$R"
    Write-Host "   $CY╚════════════════════════════════════════════════════════════════════════╝$R"
}
Start-Sleep -Seconds 1

Show-ESPHeader
$nodeCheck = Get-Command node -ErrorAction SilentlyContinue

if ($nodeCheck) {
    Write-Host "   $CY╔════════════════════════════════════════════════════════════════════════╗$R"
    Write-Host "   $CY║$R                                                                        $CY║$R"
    Write-Host "   $CY║$R      $GY[$GR  OK  $GY]$WH Node.js runtime                 $GR▸ DETECTED$R               $CY║$R"
    Write-Host "   $CY║$R      $GY[$GR  OK  $GY]$WH Optimization engine             $GR▸ ENABLED$R                $CY║$R"
    Write-Host "   $CY║$R      $GY[$GR  OK  $GY]$WH Package manager                 $GR▸ READY$R                  $CY║$R"
    Write-Host "   $CY║$R                                                                        $CY║$R"
    Write-Host "   $CY╠════════════════════════════════════════════════════════════════════════╣$R"
    Write-Host "   $CY║$R                                                                        $CY║$R"
    Write-Host "   $CY║$R      $AM◆  MODE    $WH Development Server $GY(Vite HMR)$R                         $CY║$R"
    Write-Host "   $CY║$R      $AM◆  ENGINE  $WH Node.js V8 Core$R                                       $CY║$R"
    Write-Host "   $CY║$R      $AM◆  PORT    $WH 3000$R                                                  $CY║$R"
    Write-Host "   $CY║$R      $AM◆  LOGS    $WH Silent Runtime Active$R                                 $CY║$R"
    Write-Host "   $CY║$R                                                                        $CY║$R"
    Write-Host "   $CY╚════════════════════════════════════════════════════════════════════════╝$R"
    Write-Host ""
    
    Set-Location "app_unified"
    if (-not (Test-Path "node_modules")) {
        Write-Host "   $GY[ INFO ] node_modules missing. Installing dependencies...$R"
        npm.cmd install
    }
    
    Write-Host "   $GY[ INFO ] Generando pre-cálculos JSON para carga instantánea...$R"
    node tools/preprocesar_datos.js
    
    npm.cmd run dev -- --logLevel silent
}
else {
    Write-Host "   $CY╔════════════════════════════════════════════════════════════════════════╗$R"
    Write-Host "   $CY║$R                                                                        $CY║$R"
    Write-Host "   $CY║$R      $GY[$YE WARN $GY]$WH Node.js runtime                 $YE▸ NOT FOUND$R               $CY║$R"
    Write-Host "   $CY║$R      $GY[$AM  >>  $GY]$WH Activating Windows native compatibility layer . . .$R       $CY║$R"
    Write-Host "   $CY║$R                                                                        $CY║$R"
    Write-Host "   $CY╠════════════════════════════════════════════════════════════════════════╣$R"
    Write-Host "   $CY║$R                                                                        $CY║$R"
    Write-Host "   $CY║$R      $AM◆  SERVER  $WH http://localhost:4001$R                                  $CY║$R"
    Write-Host "   $CY║$R      $AM◆  MODE    $WH Static file server  $GY(Standalone)$R                        $CY║$R"
    Write-Host "   $CY║$R      $AM◆  STATUS  $GR ACTIVE $GY-- do not close this window$R                      $CY║$R"
    Write-Host "   $CY║$R                                                                        $CY║$R"
    Write-Host "   $CY╚════════════════════════════════════════════════════════════════════════╝$R"
    Write-Host ""
    
    $port = 4001
    $p = "app_unified\dist"
    $l = New-Object System.Net.HttpListener
    while ($true) {
        try {
            $l.Prefixes.Clear()
            $l.Prefixes.Add("http://localhost:$port/")
            $l.Start()
            break
        }
        catch {
            $port++
        }
    }
    Write-Host "   $GR Server started on port $port$R" -ForegroundColor Cyan
    Start-Process "http://localhost:$port"
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