# uninstall-service.ps1 -- quita el servicio instalado por install-service.ps1
param([string]$ServiceName = "MadridHagamosloRealApi")

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "Corre esto como Administrador."
    exit 1
}

Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
sc.exe delete $ServiceName
Write-Host "Servicio '$ServiceName' eliminado."
