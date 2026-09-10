# bootstrap-dev-db.ps1
# Un solo comando para dejar SQL Server (o SQL Express) listo en una máquina
# nueva: crea la base MadridHagamosloReal (si no existe), aplica TODOS los
# 00N_*.sql en orden, y -- a menos que pidas lo contrario -- la llena con el
# histórico real desde desktop/madrid.db (mismo dataset que trae la app
# instalada). Resuelve el problema real que ya nos pasó: clonar el proyecto
# en otro equipo y encontrar que la base ni existe, sin ningún .bak a mano.
#
# Requiere sqlcmd (SQL Server / SQL Server Command Line Utilities). Por
# defecto usa autenticación de Windows. El paso de datos usa el Python ya
# committeado en ml-service/.venv -- un clon nuevo del repo ya lo trae, no
# hace falta "pip install" para este flujo.
#
# Uso:
#   .\ml-service\sql\bootstrap-dev-db.ps1
#   .\ml-service\sql\bootstrap-dev-db.ps1 -Server ".\SQLEXPRESS"
#   .\ml-service\sql\bootstrap-dev-db.ps1 -User sa -Password "..."   # si no usas auth de Windows
#   .\ml-service\sql\bootstrap-dev-db.ps1 -SchemaOnly                # esquema vacío, sin el paso de datos

param(
    [string]$Server = "localhost",
    [string]$Database = "MadridHagamosloReal",
    [string]$User,
    [string]$Password,
    [switch]$SchemaOnly
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

Write-Host "`nEsquema listo en '$Database'." -ForegroundColor Green

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$sqlitePath = Join-Path $repoRoot "desktop\madrid.db"
$venvPython = Join-Path $repoRoot "ml-service\.venv\Scripts\python.exe"
$seedScript = Join-Path $PSScriptRoot "..\data\seed_dev_db_from_sqlite.py"

if ($SchemaOnly) {
    Write-Host "-SchemaOnly: se deja vacía, sin correr el paso de datos." -ForegroundColor Yellow
    exit 0
}

if (-not (Test-Path $sqlitePath) -or -not (Test-Path $venvPython)) {
    Write-Host "No se encontró desktop\madrid.db o ml-service\.venv -- se deja el esquema vacío." -ForegroundColor Yellow
    Write-Host "(Esto es normal si clonaste una copia liviana sin esas carpetas.)" -ForegroundColor Yellow
    exit 0
}

Write-Host "`n==> Llenando la base con el histórico real desde desktop\madrid.db..." -ForegroundColor Cyan

# Se pasan las credenciales como variables de entorno al subproceso de Python en
# vez de depender de que exista ml-service\.env -- así este único comando funciona
# de punta a punta en un clon nuevo sin pasos manuales de por medio.
$env:SQL_SERVER = $Server
$env:SQL_DATABASE = $Database
if ($User) {
    $env:SQL_USE_WINDOWS_AUTH = "false"
    $env:SQL_USER = $User
    $env:SQL_PASSWORD = $Password
} else {
    $env:SQL_USE_WINDOWS_AUTH = "true"
}

& $venvPython $seedScript --sqlite-path $sqlitePath
$seedExit = $LASTEXITCODE

Remove-Item Env:\SQL_SERVER, Env:\SQL_DATABASE, Env:\SQL_USE_WINDOWS_AUTH -ErrorAction SilentlyContinue
Remove-Item Env:\SQL_USER, Env:\SQL_PASSWORD -ErrorAction SilentlyContinue

if ($seedExit -ne 0) {
    Write-Error "El esquema quedó listo, pero el paso de datos falló (exit $seedExit) -- revisa el error de arriba."
    exit 1
}

Write-Host "`nListo. '$Database' tiene el esquema completo Y el histórico real cargado." -ForegroundColor Green
