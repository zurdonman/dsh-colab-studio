# ============================================================
#  patch_mcp.ps1 — reapunta el puente MCP de Colab Studio en el perfil de DSH
#  (equivalente en PowerShell de tools/patch_mcp.py, para no depender de Python)
#
#    powershell -ExecutionPolicy Bypass -File tools\patch_mcp.ps1 -Mcp "C:\...\mcp-colab.mjs"
#
#  Modifica <perfil DSH>\.dsh\profiles\web\cordis.patch.yml: dentro del bloque
#  "mcp-colab-studio" cambia la ruta del puente (args) y su cwd. Si el bloque no
#  existe, lo añade al final del fichero.
# ============================================================
param(
  [Parameter(Mandatory = $true)][string]$Mcp,
  [string]$Profile = $(if ($env:DSH_PROFILE) { $env:DSH_PROFILE } else { Join-Path $env:USERPROFILE '.dsh\profiles\web\cordis.patch.yml' })
)
$ErrorActionPreference = 'Stop'

$Mcp = [System.IO.Path]::GetFullPath($Mcp)
$Cwd = Split-Path -Parent $Mcp
if (-not (Test-Path -LiteralPath $Mcp)) {
  Write-Host "ERROR: no existe $Mcp"
  exit 1
}

# Escribe siempre en UTF-8 SIN BOM: algunos parsers YAML (js-yaml) fallan con el BOM.
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
function Write-TextUtf8([string]$Path, [string]$Text) {
  $dir = Split-Path -Parent $Path
  if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  [System.IO.File]::WriteAllText($Path, $Text, $Utf8NoBom)
}

$Block = @"
- insert:
    - id: mcp-colab-studio
      name: "@deepseek-ai/dsh-mcp-client"
      config:
        serverName: colab-studio
        transport: stdio
        command: node
        args:
          - $Mcp
        cwd: $Cwd
        failOnStartupError: false
        toolCallTimeoutMs: 120000
"@

if (-not (Test-Path -LiteralPath $Profile)) {
  Write-TextUtf8 $Profile $Block
  Write-Host "perfil MCP creado: $Profile"
} else {
  $lines = [System.Collections.Generic.List[string]]::new()
  foreach ($l in [System.IO.File]::ReadAllLines($Profile)) { $lines.Add($l) }

  $idx = -1
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match '^\s*-\s+.*mcp-colab\.mjs\s*$') { $idx = $i; break }
  }

  if ($idx -ge 0) {
    $indent = ([regex]::Match($lines[$idx], '^\s*')).Value
    $lines[$idx] = "$indent- $Mcp"
    for ($j = $idx; $j -lt [Math]::Min($idx + 8, $lines.Count); $j++) {
      $m = [regex]::Match($lines[$j], '^(\s*)cwd\s*:')
      if ($m.Success) {
        $lines[$j] = $m.Groups[1].Value + 'cwd: ' + $Cwd
        break
      }
    }
  } else {
    while ($lines.Count -gt 0 -and $lines[$lines.Count - 1].Trim() -eq '') { $lines.RemoveAt($lines.Count - 1) }
    $lines.Add('')
    foreach ($l in ($Block -split "`r?`n")) { if ($l.Trim() -ne '') { $lines.Add($l) } }
  }

  Write-TextUtf8 $Profile (($lines -join "`n") + "`n")
  Write-Host "perfil MCP actualizado: $Profile"
}

Write-Host "  mcp : $Mcp"
Write-Host "  cwd : $Cwd"
exit 0
