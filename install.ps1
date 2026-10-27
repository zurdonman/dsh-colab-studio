# ============================================================
#  DSH Colab Studio — instalador (Windows PowerShell)
#
#    powershell -ExecutionPolicy Bypass -File install.ps1
#    powershell -ExecutionPolicy Bypass -File install.ps1 -InstallDir "D:\DSH Colab Studio"
#
#  Instala:
#    - la skill  -> %USERPROFILE%\.dsh\skills\panel-colab.md
#    - el panel  -> <InstallDir> (por defecto %USERPROFILE%\DSH Colab Studio)
#    - el puente MCP en el perfil de DSH
# ============================================================
param(
  [string]$InstallDir = $(if ($env:DSH_COLAB_HOME) { $env:DSH_COLAB_HOME } else { Join-Path $env:USERPROFILE 'DSH Colab Studio' }),
  [string]$SkillDir   = $(if ($env:DSH_SKILLS_DIR) { $env:DSH_SKILLS_DIR } else { Join-Path $env:USERPROFILE '.dsh\skills' }),
  [string]$Profile    = $(if ($env:DSH_PROFILE) { $env:DSH_PROFILE } else { Join-Path $env:USERPROFILE '.dsh\profiles\web\cordis.patch.yml' }),
  [switch]$SkipMcp
)
$ErrorActionPreference = 'Stop'
$Here = Split-Path -Parent $MyInvocation.MyCommand.Definition

Write-Host '==> Instalando DSH Colab Studio'
Write-Host "    panel : $InstallDir"
Write-Host "    skill : $SkillDir"

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path $SkillDir  | Out-Null

# --- panel (copia el contenido de app/, ignorando logs y la carpeta prueba) ---
Get-ChildItem -Path (Join-Path $Here 'app') -Force | ForEach-Object {
  if ($_.Name -eq 'prueba') { return }
  if ($_.Name -like '*.log') { return }
  Copy-Item -Path $_.FullName -Destination $InstallDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path (Join-Path $InstallDir 'prueba') | Out-Null

# --- lanzadores de doble clic (.bat) ---
Get-ChildItem -Path $Here -Filter '*.bat' -File -ErrorAction SilentlyContinue | ForEach-Object {
  Copy-Item -Path $_.FullName -Destination $InstallDir -Force
}
Write-Host "    OK  lanzadores .bat copiados a $InstallDir"

# --- skill ---
Copy-Item -Path (Join-Path $Here 'skills\panel-colab.md') -Destination (Join-Path $SkillDir 'panel-colab.md') -Force
Write-Host "    OK  skill copiada a $(Join-Path $SkillDir 'panel-colab.md')"

# --- puente MCP ---
# PowerShell primero (no requiere Python); si falla, se intenta el equivalente en Python.
if (-not $SkipMcp) {
  $mcpPath = Join-Path $InstallDir 'mcp-colab.mjs'
  $patched = $false
  try {
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Here 'tools\patch_mcp.ps1') -Mcp $mcpPath -Profile $Profile
    if ($LASTEXITCODE -eq 0) { $patched = $true }
  } catch { }
  if (-not $patched) {
    $py = Get-Command python -ErrorAction SilentlyContinue
    if ($py) {
      & $py.Source (Join-Path $Here 'tools\patch_mcp.py') --mcp $mcpPath --profile $Profile
    } else {
      Write-Host "    AVISO: no se pudo parchear el MCP automaticamente; edita a mano $Profile para apuntar a:"
      Write-Host "       args: - $mcpPath"
      Write-Host "       cwd : $InstallDir"
    }
  }
}

Write-Host ''
Write-Host '==> Listo. Pasos siguientes:'
Write-Host '  1) Instala el CLI de Colab:      npm i -g google-colab-cli'
Write-Host '  2) Autentica Google:             colab auth login   (o el boton del panel)'
Write-Host "  3) Arranca el panel:             `"$InstallDir\panel.cmd`" start"
Write-Host '  4) Abre en el navegador:         http://127.0.0.1:8787'
Write-Host ''
Write-Host '  La skill "panel-colab" ya esta en DSH: reinicia DSH para que la cargue.'
