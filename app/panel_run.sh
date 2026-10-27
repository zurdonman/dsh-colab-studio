#!/usr/bin/env bash
# Ejecuta un comando A TRAVÉS del panel de Colab (Termux / Linux / macOS / Git Bash / WSL).
# Toda su salida queda en vivo en la vista "Ejecución" y en el "Registro"
# del panel (http://127.0.0.1:8787) mientras se ejecuta.
#   uso: panel_run.sh "comando shell" ["etiqueta"]
# En Windows: panel_run.ps1 "comando" ["etiqueta"]
set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
CMD="${1:-}"
LABEL="${2:-Agente}"
if [ -z "$CMD" ]; then
  echo "uso: panel_run.sh 'comando' [etiqueta]" >&2
  exit 2
fi

# Node es el runtime del panel: siempre está. Python es solo el plan B.
if command -v node >/dev/null 2>&1; then
  exec node "$DIR/panel_run.mjs" "$CMD" "$LABEL"
fi
for c in python3 python py; do
  if command -v "$c" >/dev/null 2>&1; then
    if [ "$c" = "py" ]; then exec py -3 "$DIR/panel_run.py" "$CMD" "$LABEL"; fi
    exec "$c" "$DIR/panel_run.py" "$CMD" "$LABEL"
  fi
done
echo "no encuentro node ni python en el PATH" >&2
exit 127
