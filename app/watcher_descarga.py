#!/usr/bin/env python3
"""Vigilante automatico: cuando la generacion termina, descarga el MP4 al
telefono por base64 (via el panel) y cierra la sesion. No necesita atencion.
Uso: python3 watcher_descarga.py <session> <etiqueta_contains>
"""
import json, os, re, sys, time, base64, urllib.request

PANEL = "http://127.0.0.1:8787"
SCRIPT = "/storage/emulated/0/Download/rensi colabdsh/37_descargar_b64.py"
OUTDIR = "/storage/emulated/0/Download/pruebas generated"
LIVELOG = "/storage/emulated/0/Download/Panel Google Colab/prueba/live.log"
MARKER = "/storage/emulated/0/Download/Panel Google Colab/prueba/descarga_ok.txt"

session = sys.argv[1] if len(sys.argv) > 1 else "ltx3"
label_contains = sys.argv[2] if len(sys.argv) > 2 else "Historia 1 min"


def log(msg):
    line = "[%s] WATCHER: %s" % (time.strftime("%H:%M:%S"), msg)
    print(line, flush=True)
    try:
        with open(LIVELOG, "a") as f:
            f.write(line + "\n")
    except Exception:
        pass


def post(path, data, timeout=60):
    req = urllib.request.Request(PANEL + path, data=json.dumps(data).encode(),
                                 headers={"content-type": "application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=timeout).read().decode())


def current():
    try:
        return (post("/api/exec/current", {}) or {}).get("exec")
    except Exception:
        return None


def wait_generation():
    log("esperando a que termine '%s'..." % label_contains)
    while True:
        e = current()
        if e and e.get("status") in ("done", "error") and label_contains in (e.get("label") or ""):
            return e
        time.sleep(15)


def download():
    log("descargando MP4 por base64 (ejecucion silenciosa en el panel)...")
    r = post("/api/exec/script", {"session": session, "file": SCRIPT, "quiet": True,
                                  "label": "Descarga automatica a tu telefono",
                                  "timeout": 1800000}, timeout=2400)
    out = (r.get("stdout") or "") + (r.get("stderr") or "")
    if "B64_END" not in out:
        log("ERROR: la transferencia no devolvio datos. stderr=%s" % (r.get("stderr") or "")[:300])
        return False
    meta = re.search(r"B64_META (\S+) bytes=(\d+) b64=(\d+) sha=(\w+)", out)
    chunks = re.findall(r"^B64CHUNK (\d+) ([A-Za-z0-9+/=]+)$", out, re.M)
    if not chunks:
        log("ERROR: no hay chunks B64")
        return False
    b64 = "".join(c[1] for c in chunks)
    data = base64.b64decode(b64)
    os.makedirs(OUTDIR, exist_ok=True)
    name = (meta.group(1).split("/")[-1] if meta else "video.mp4")
    if not name.endswith(".mp4"):
        name = "13_historia_1minuto.mp4"
    dest = os.path.join(OUTDIR, name)
    with open(dest, "wb") as f:
        f.write(data)
    ok = True
    if meta:
        exp = int(meta.group(2))
        ok = (len(data) == exp)
        log("bytes: %d (esperados %d) -> %s" % (len(data), exp, "OK" if ok else "MISMATCH"))
    log("DESCARGA_OK %s (%.1f MB)" % (dest, len(data) / 1e6))
    with open(MARKER, "w") as f:
        f.write("%s %d bytes\n" % (dest, len(data)))
    return ok


def close():
    try:
        post("/api/runtime/stop", {"session": session}, timeout=180)
        log("sesion %s cerrada" % session)
    except Exception as e:
        log("aviso al cerrar la sesion: %s" % e)


if os.path.exists(MARKER):
    log("ya estaba descargado: %s" % open(MARKER).read().strip())
    sys.exit(0)

e = wait_generation()
if e.get("status") != "done":
    log("la generacion termino con ERROR: %s" % str(e.get("output") or "")[-300:])
    sys.exit(2)
log("generacion OK (%s)" % (e.get("output") or "").strip().split("\n")[-1][:160])
if download():
    close()
    log("TAREA COMPLETA")
else:
    log("fallo la descarga")
    sys.exit(3)
