# ============================================================
#  DSH Colab Studio — panel_run.ps1 (Windows)
#  Ejecuta un comando A TRAVES del panel: la salida se ve en vivo
#  en la vista "Ejecucion" y en el "Registro" del panel.
#
#    powershell -ExecutionPolicy Bypass -File panel_run.ps1 "comando" ["etiqueta"]
# ============================================================
param(
  [Parameter(Mandatory = $true, Position = 0)][string]$Command,
  [Parameter(Position = 1)][string]$Label = 'Agente'
)
$ErrorActionPreference = 'Continue'
$Dir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$Port = if ($env:COLAB_PANEL_PORT) { $env:COLAB_PANEL_PORT } else { '8787' }
$Url  = "http://127.0.0.1:$Port"

$body = @{ command = $Command; shell = $true; label = $Label; timeout = 7200000 } | ConvertTo-Json
try {
  $r = Invoke-RestMethod -Uri "$Url/api/exec/run" -Method Post -Body $body `
        -ContentType 'application/json' -TimeoutSec 7300
} catch {
  Write-Host "ERROR panel_run: $($_.Exception.Message)"
  exit 3
}
$out = ([string]$r.stdout) + ([string]$r.stderr)
if ($out.Length -gt 4000) { $out = $out.Substring($out.Length - 4000) }
Write-Host $out
if ($r.ok) { exit 0 } else { exit 1 }
