#!/usr/bin/env bash
# ============================================================
# DSH Colab Studio — panel.sh
# Encender / apagar / reiniciar / consultar el panel local.
#
#   bash panel.sh start | stop | restart | status
#
# Funciona en: Termux/Android, Linux, macOS, Git Bash (Windows) y WSL.
# Usa un fichero de PID (panel.pid) para no depender de pgrep/pkill,
# que Git Bash no trae.
# ============================================================
DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="${COLAB_PANEL_PORT:-8787}"
URL="http://127.0.0.1:$PORT"
PIDFILE="$DIR/panel.pid"

vivo(){ curl -sf "$URL/api/health" >/dev/null 2>&1; }

pid_de(){ [ -f "$PIDFILE" ] || return 1; cat "$PIDFILE" 2>/dev/null; }

matar(){
  P="$(pid_de)"
  if [ -n "$P" ]; then kill "$P" 2>/dev/null; rm -f "$PIDFILE"; fi
  # respaldo por si el PID guardado ya no vale (solo si las herramientas existen)
  if command -v pkill >/dev/null 2>&1; then pkill -f "node server.mjs" 2>/dev/null; fi
  if command -v taskkill >/dev/null 2>&1; then taskkill //F //IM node.exe >/dev/null 2>&1; fi
}

case "$1" in
  start)
    if vivo; then
      echo "ya está encendido → $URL"
    else
      cd "$DIR" || { echo "no encuentro $DIR"; exit 1; }
      nohup node server.mjs > panel.log 2>&1 &
      echo $! > "$PIDFILE"
      sleep 2
      if vivo; then echo "encendido ✓ → $URL"; else echo "arrancó con avisos, revisa: $DIR/panel.log"; fi
    fi ;;
  stop)
    if vivo || [ -f "$PIDFILE" ]; then
      matar; sleep 1
      vivo && echo "⚠ sigue respondiendo" || echo "detenido ✓ (sin sesiones Colab que tocar: esto solo mata el panel local)"
    else
      echo "no había servidor"
    fi ;;
  restart)
    bash "$DIR/panel.sh" stop; sleep 1; bash "$DIR/panel.sh" start ;;
  status)
    if vivo; then echo "encendido ✓ → $URL"; else echo "apagado ✗ (arranca con: bash panel.sh start)"; fi ;;
  *)
    echo "uso: bash panel.sh start|stop|restart|status" ;;
esac
