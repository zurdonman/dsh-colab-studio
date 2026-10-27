# ============================================================
#  DSH Colab Studio — live.ps1 (Windows)
#  Registra un hito en la bitacora "En directo" del panel.
#
#    powershell -ExecutionPolicy Bypass -File live.ps1 "texto del hito"
# ============================================================
param(
  [Parameter(Mandatory = $true, Position = 0)][string[]]$Message
)
$ErrorActionPreference = 'Continue'
$Dir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$Log  = Join-Path $Dir 'prueba\live.log'
$Text = ($Message -join ' ')
try {
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Log) | Out-Null
  $stamp = Get-Date -Format 'HH:mm:ss'
  Add-Content -Path $Log -Value "[$stamp] $Text" -Encoding UTF8
} catch {
  Write-Host "aviso live: $($_.Exception.Message)"
  exit 1
}
Write-Host $Text
