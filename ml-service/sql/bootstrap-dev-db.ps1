# bootstrap-dev-db.ps1
# Crea la base MadridHagamosloReal en un SQL Server local (si no existe) y corre
# TODOS los scripts 00N_*.sql de esta carpeta en orden -- resuelve el problema real
# que ya nos pasó: mover el proyecto a otro equipo y descubrir que la base ni
# siquiera existe ahí, sin ningún .bak a mano.
#
# Requiere sqlcmd (viene con SQL Server / SQL Server Command Line Utilities).
# Por defecto usa autenticación de Windows -- funciona igual que "sqlcmd -S localhost -E".
#
# Uso:
#   .\ml-service\sql\bootstrap-dev-db.ps1
#   .\ml-service\sql\bootstrap-dev-db.ps1 -Server "MIPC\SQLEXPRESS"
#   .\ml-service\sql\bootstrap-dev-db.ps1 -User sa -Password "..."   # si no usas auth de Windows

param(
    [string]$Server = "localhost",
    [string]$Database = "MadridHagamosloReal",
    [string]$User,
    [string]$Password
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command sqlcmd -ErrorAction SilentlyContinue)) {
    Write-Error "No se encontró 'sqlcmd' en el PATH. Instala las 'SQL Server Command Line Utilities' o corre esto desde una máquina con SQL Server Management Studio instalado."
    exit 1
}

$authArgs = if ($User) { @("-U", $User, "-P", $Password) } else { @("-E") }

function Invoke-Sqlcmd2($query, $inputFile) {
    $args = @("-S", $Server) + $authArgs
    if ($inputFile) { $args += @("-i", $inputFile) } else { $args += @("-Q", $query) }
    & sqlcmd @args
    if ($LASTEXITCODE -ne 0) { throw "sqlcmd falló (exit $LASTEXITCODE)" }
}

Write-Host "==> Verificando/creando la base '$Database' en '$Server'..." -ForegroundColor Cyan
Invoke-Sqlcmd2 "IF DB_ID('$Database') IS NULL CREATE DATABASE [$Database];"

$sqlFiles = Get-ChildItem -Path $PSScriptRoot -Filter "0*.sql" | Sort-Object Name
foreach ($f in $sqlFiles) {
    Write-Host "==> Aplicando $($f.Name)..." -ForegroundColor Cyan
    Invoke-Sqlcmd2 -inputFile $f.FullName
}

Write-Host "`nListo. La base '$Database' tiene el esquema completo (vacía -- sin histórico)." -ForegroundColor Green
Write-Host "Para tener datos reales sin correr todo el pipeline de fetch_*.py, usa desktop/madrid.db" -ForegroundColor Green
Write-Host "(SQLite con el histórico completo) apuntando la API con DB_PROVIDER=sqlite en vez de esta base." -ForegroundColor Green
