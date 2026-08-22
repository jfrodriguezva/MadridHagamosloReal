# install-service.ps1
# Instala el API (Madrid.Api) como Servicio de Windows -- corre en segundo
# plano sin consola, arranca solo con Windows.
#
# IMPORTANTE: este script MODIFICA el Panel de Servicios de Windows.
# Corre esto TÚ, con PowerShell como Administrador -- no es algo que deba
# ejecutar un asistente automáticamente. Es reversible: usa uninstall-service.ps1
# para quitarlo.
#
# Uso:
#   1. Publica la API en modo self-contained:
#      cd api
#      dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o publish
#   2. Corre este script como Administrador:
#      .\install-service.ps1 -PublishPath "C:\ruta\a\api\publish"

param(
    [string]$PublishPath = "$PSScriptRoot\api",
    [string]$ServiceName = "MadridHagamosloRealApi",
    [int]$Port = 10001,
    [string]$SqlitePath = "$PSScriptRoot\data\madrid.db"
)

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "Corre este script como Administrador (clic derecho en PowerShell -> Ejecutar como administrador)."
    exit 1
}

$exePath = Join-Path $PublishPath "Madrid.Api.exe"
if (-not (Test-Path $exePath)) {
    Write-Error "No se encontró $exePath -- primero corre 'dotnet publish' (ver comentario arriba)."
    exit 1
}

if (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) {
    Write-Host "El servicio '$ServiceName' ya existe. Deteniéndolo para actualizar..."
    Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    sc.exe delete $ServiceName | Out-Null
    Start-Sleep -Seconds 2
}

$binPath = "`"$exePath`" --urls http://localhost:$Port --DB_PROVIDER=sqlite --SQLITE_PATH=`"$SqlitePath`""
New-Service -Name $ServiceName `
    -BinaryPathName $binPath `
    -DisplayName "Madrid Hagámoslo Real - API" `
    -Description "API local del portal Madrid Hagámoslo Real (predicción, jugadores, calificaciones)." `
    -StartupType Automatic

Start-Service -Name $ServiceName
Write-Host "Servicio '$ServiceName' instalado y arrancado en http://localhost:$Port"
Write-Host "Para quitarlo: .\uninstall-service.ps1"
