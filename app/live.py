#!/usr/bin/env python3
"""Escribe un hito en la bitacora "En directo" del panel (multiplataforma).

    python3 live.py "texto del hito"
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
LOG = os.path.join(HERE, "prueba", "live.log")
MSG = " ".join(sys.argv[1:])
if not MSG:
    print("uso: live.py 'texto'", file=sys.stderr)
    sys.exit(2)

try:
    os.makedirs(os.path.dirname(LOG), exist_ok=True)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write("[%s] %s\n" % (datetime.datetime.now().strftime("%H:%M:%S"), MSG))
except Exception as e:
    print("aviso live:", e)
    sys.exit(1)
print(MSG)
