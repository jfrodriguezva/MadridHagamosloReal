# build.ps1
# Reemplaza los 4 pasos manuales de "Recompilar el instalador" en RECOVERY.md
# por un solo comando. No instala nada ni toca el sistema (a diferencia de
# install-service.ps1) -- solo compila y deja el .exe en installer\Output\.
#
# Requiere: .NET SDK 10, Node.js, e Inno Setup 6 (ISCC.exe).
#
# Uso (desde cualquier carpeta):
#   .\installer\build.ps1
#   .\installer\build.ps1 -ApiUrl "http://localhost:10001"   # si cambiaste el puerto
#   .\installer\build.ps1 -SkipSyncCheck                     # sin el aviso interactivo de sync (CI/automatizado)

param(
    [string]$ApiUrl = "http://localhost:10001",
    [string]$IsccPath = "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe",
    [switch]$SkipSyncCheck
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }

if (-not (Test-Path $IsccPath)) {
    Write-Error "No se encontró Inno Setup 6 en '$IsccPath'. Instálalo (https://jrsoftware.org/isinfo.php) o pasa -IsccPath."
    exit 1
}

# El instalador empaqueta el desktop\madrid.db que YA está en disco tal cual --
# si no corriste ml-service/data/export_to_sqlite.py después de cargar datos nuevos
# en SQL Server, el instalador sale con histórico viejo sin ningún error visible
# (justo el tipo de bug silencioso que ya mordió a este proyecto una vez). Un aviso
# con la fecha real del archivo es más barato que descubrirlo probando en otra máquina.
$dbPath = Join-Path $RepoRoot "desktop\madrid.db"
if (-not $SkipSyncCheck) {
    if (Test-Path $dbPath) {
        $age = (Get-Date) - (Get-Item $dbPath).LastWriteTime
        Write-Host "`ndesktop\madrid.db fue generado hace $([math]::Round($age.TotalHours, 1)) horas." -ForegroundColor Yellow
    } else {
        Write-Host "`ndesktop\madrid.db no existe todavia." -ForegroundColor Yellow
    }
    Write-Host "Si cargaste datos nuevos en SQL Server desde entonces, corre primero:" -ForegroundColor Yellow
    Write-Host "  cd ml-service; .venv\Scripts\python.exe data\export_to_sqlite.py`n" -ForegroundColor Yellow
    $answer = Read-Host "Continuar con el madrid.db actual? (s/N)"
    if ($answer -notmatch '^[sS]') { Write-Host "Cancelado."; exit 0 }
}

try {
    Step "1/4 - Build de produccion del web (NEXT_PUBLIC_API_URL=$ApiUrl)"
    Push-Location (Join-Path $RepoRoot "web")
    $env:NEXT_PUBLIC_API_URL = $ApiUrl
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build fallo (exit $LASTEXITCODE)" }
    Remove-Item Env:\NEXT_PUBLIC_API_URL -ErrorAction SilentlyContinue
    Copy-Item -Recurse -Force "public" ".next\standalone\"
    New-Item -ItemType Directory -Force -Path ".next\standalone\.next" | Out-Null
    Copy-Item -Recurse -Force ".next\static" ".next\standalone\.next\static"
    Pop-Location

    Step "2/4 - Publicando la API self-contained"
    Push-Location (Join-Path $RepoRoot "api")
    dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o publish
    if ($LASTEXITCODE -ne 0) { throw "dotnet publish (api) fallo (exit $LASTEXITCODE)" }
    Pop-Location

    Step "3/4 - Publicando la app de escritorio (WPF)"
    Push-Location (Join-Path $RepoRoot "desktop")
    dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o "bin\Release\net10.0-windows\win-x64\publish"
    if ($LASTEXITCODE -ne 0) { throw "dotnet publish (desktop) fallo (exit $LASTEXITCODE)" }
    Pop-Location

    Step "4/4 - Compilando el instalador con Inno Setup"
    Push-Location (Join-Path $RepoRoot "installer")
    & $IsccPath "MadridHagamosloReal.iss"
    if ($LASTEXITCODE -ne 0) { throw "ISCC.exe fallo (exit $LASTEXITCODE)" }
    Pop-Location

    Write-Host "`nListo: installer\Output\MadridHagamosloReal-Setup.exe" -ForegroundColor Green
}
catch {
    while ((Get-Location).Path -ne $RepoRoot.Path -and (Get-Location).Path.StartsWith($RepoRoot.Path)) { Pop-Location }
    Write-Error "Build del instalador interrumpido: $_"
    exit 1
}
