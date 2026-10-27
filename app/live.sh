#!/usr/bin/env bash
# Registra un hito en la bitácora "En directo" del panel (Termux / Linux / macOS / Git Bash / WSL).
#   uso: bash live.sh "texto del hito"
# En Windows: powershell -ExecutionPolicy Bypass -File live.ps1 "texto"
set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
if [ $# -lt 1 ]; then
  echo "uso: live.sh 'texto'" >&2
  exit 2
fi

# Node es el runtime del panel: siempre está. Python es solo el plan B.
if command -v node >/dev/null 2>&1; then
  exec node "$DIR/live.mjs" "$@"
fi
for c in python3 python py; do
  if command -v "$c" >/dev/null 2>&1; then
    if [ "$c" = "py" ]; then exec py -3 "$DIR/live.py" "$@"; fi
    exec "$c" "$DIR/live.py" "$@"
  fi
done
echo "no encuentro node ni python en el PATH" >&2
exit 127
