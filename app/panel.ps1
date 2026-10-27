# ============================================================
#  DSH Colab Studio — panel.ps1 (Windows PowerShell)
#  Encender / apagar / reiniciar / consultar el panel local.
#
#    powershell -ExecutionPolicy Bypass -File panel.ps1 start
#    powershell -ExecutionPolicy Bypass -File panel.ps1 stop
#    powershell -ExecutionPolicy Bypass -File panel.ps1 restart
#    powershell -ExecutionPolicy Bypass -File panel.ps1 status
#
#  Equivalente en CMD:  panel.cmd start
# ============================================================
$ErrorActionPreference = 'Continue'
$Dir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$Port = if ($env:COLAB_PANEL_PORT) { $env:COLAB_PANEL_PORT } else { '8787' }
$Url  = "http://127.0.0.1:$Port"

function Test-Panel {
  try {
    Invoke-WebRequest -Uri "$Url/api/health" -TimeoutSec 3 -UseBasicParsing | Out-Null
    return $true
  } catch { return $false }
}

function Get-PanelPid {
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like '*server.mjs*' } |
    Select-Object -ExpandProperty ProcessId
}

function Start-Panel {
  $out = Join-Path $Dir 'panel.log'
  $err = Join-Path $Dir 'panel.err.log'
  Start-Process -FilePath 'node' -ArgumentList 'server.mjs' -WorkingDirectory $Dir `
                -RedirectStandardOutput $out -RedirectStandardError $err -WindowStyle Hidden
  Start-Sleep -Seconds 2
  if (Test-Panel) { Write-Host "encendido ✓ → $Url" }
  else { Write-Host "arrancó con avisos, revisa: $out" }
}

switch ($args[0]) {
  'start' {
    $pids = Get-PanelPid
    if ($pids) { Write-Host "ya está encendido → $Url" } else { Start-Panel }
  }
  'stop' {
    $pids = Get-PanelPid
    if ($pids) {
      $pids | ForEach-Object { Stop-Process -Id $_ -Force }
      Start-Sleep -Seconds 1
      Write-Host "detenido ✓ (sin sesiones Colab que tocar: esto solo mata el panel local)"
    } else { Write-Host "no había servidor" }
  }
  'restart' {
    & (Join-Path $Dir 'panel.ps1') stop
    Start-Sleep -Seconds 1
    & (Join-Path $Dir 'panel.ps1') start
  }
  'status' {
    if (Test-Panel) { Write-Host "encendido ✓ → $Url" }
    else { Write-Host "apagado ✗ (arranca con: panel.cmd start)" }
  }
  default { Write-Host "uso: panel.ps1 start|stop|restart|status" }
}
