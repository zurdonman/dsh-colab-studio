#!/usr/bin/env python3
"""Ejecuta un comando A TRAVES del panel de Colab (multiplataforma).

Toda la salida queda en vivo en la vista "Ejecucion" y en el "Registro" del
panel (http://127.0.0.1:8787) mientras se ejecuta.

    python3 panel_run.py "comando shell" ["etiqueta"]
"""
import json
import os
import sys
import urllib.request

PANEL = os.environ.get("COLAB_PANEL_URL", "http://127.0.0.1:8787")
CMD = sys.argv[1] if len(sys.argv) > 1 else ""
LABEL = sys.argv[2] if len(sys.argv) > 2 else "Agente"

if not CMD:
    print("uso: panel_run.py 'comando' [etiqueta]", file=sys.stderr)
    sys.exit(2)

data = json.dumps({
    "command": CMD,
    "shell": True,
    "label": LABEL,
    "timeout": 7200000,
}).encode()
req = urllib.request.Request(
    PANEL + "/api/exec/run", data=data, headers={"content-type": "application/json"}
)
try:
    r = json.loads(urllib.request.urlopen(req, timeout=7300).read().decode())
except Exception as e:
    print("ERROR panel_run:", e)
    sys.exit(3)
out = (r.get("stdout") or "") + (r.get("stderr") or "")
print(out[-4000:])
sys.exit(0 if r.get("ok") else 1)
