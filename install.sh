#!/usr/bin/env bash
# ============================================================
#  DSH Colab Studio — instalador (Termux / Linux / macOS)
#
#    bash install.sh [CARPETA_DE_INSTALACION]
#
#  Instala:
#    - la skill  -> ~/.dsh/skills/panel-colab.md
#    - el panel  -> <CARPETA_DE_INSTALACION> (por defecto ~/DSH Colab Studio)
#    - el puente MCP en el perfil de DSH
# ============================================================
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
INSTALL_DIR="${1:-${DSH_COLAB_HOME:-$HOME/DSH Colab Studio}}"
SKILL_DIR="${DSH_SKILLS_DIR:-$HOME/.dsh/skills}"
PROFILE="${DSH_PROFILE:-$HOME/.dsh/profiles/web/cordis.patch.yml}"
PY_BIN="${PYTHON:-}"
if [ -z "$PY_BIN" ]; then
  if command -v python3 >/dev/null 2>&1; then PY_BIN=python3; else PY_BIN=python; fi
fi

echo "==> Instalando DSH Colab Studio"
echo "    panel : $INSTALL_DIR"
echo "    skill : $SKILL_DIR"

mkdir -p "$INSTALL_DIR" "$SKILL_DIR"

# --- panel ---
cp -r "$HERE/app/." "$INSTALL_DIR/"
rm -f "$INSTALL_DIR"/*.log "$INSTALL_DIR"/panel.err.log 2>/dev/null || true
rm -rf "$INSTALL_DIR/prueba"
mkdir -p "$INSTALL_DIR/prueba"
chmod +x "$INSTALL_DIR"/*.sh 2>/dev/null || true

# --- skill ---
cp "$HERE/skills/panel-colab.md" "$SKILL_DIR/panel-colab.md"
echo "    ✓ skill copiada a $SKILL_DIR/panel-colab.md"

# --- puente MCP ---
"$PY_BIN" "$HERE/tools/patch_mcp.py" --mcp "$INSTALL_DIR/mcp-colab.mjs" --profile "$PROFILE" || true

cat <<EOF

==> Listo. Pasos siguientes:
  1) Instala el CLI de Colab:      npm i -g google-colab-cli
  2) Autentica Google:             colab auth login   (o usa el botón del panel)
  3) Arranca el panel:             bash "$INSTALL_DIR/panel.sh" start
  4) Abre en el navegador:         http://127.0.0.1:8787

  La skill "panel-colab" ya está en DSH: reinicia DSH para que la cargue.
EOF
