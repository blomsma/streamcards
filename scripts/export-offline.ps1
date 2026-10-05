$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
New-Item -ItemType Directory -Force transfer | Out-Null
& docker buildx build --platform linux/amd64 --load -t event-streamcards:3.0.0 .
if ($LASTEXITCODE -ne 0) { throw 'Bouwen mislukt.' }
& docker image save -o transfer/images.tar event-streamcards:3.0.0
if ($LASTEXITCODE -ne 0) { throw 'Export mislukt.' }
Write-Output 'Kopieer de hele repo inclusief transfer/images.tar naar de NUC.'
Write-Output 'Daar: docker image load -i transfer/images.tar en powershell -ExecutionPolicy Bypass -File scripts/start.ps1 -Offline'
