#!/usr/bin/env python3
"""Apunta el puente MCP de Colab Studio en el perfil de DSH a la instalacion actual.

En el perfil de DSH (`~/.dsh/profiles/web/cordis.patch.yml`) el servidor MCP
`mcp-colab-studio` guarda rutas absolutas (en el movil apuntan a Termux). Al
instalar en otro equipo hay que reapuntarlas.

    python3 tools/patch_mcp.py --mcp <ruta>/mcp-colab.mjs [--profile <cordis.patch.yml>]

Si el bloque no existe, lo añade al final del fichero.
"""
import argparse
import os
import re
import sys

DEFAULT_PROFILE = os.path.join(
    os.path.expanduser("~"), ".dsh", "profiles", "web", "cordis.patch.yml"
)

BLOCK = """
- insert:
    - id: mcp-colab-studio
      name: "@deepseek-ai/dsh-mcp-client"
      config:
        serverName: colab-studio
        transport: stdio
        command: node
        args:
          - {mcp}
        cwd: {cwd}
        failOnStartupError: false
        toolCallTimeoutMs: 120000
"""


def patch(profile, mcp):
    cwd = os.path.dirname(os.path.abspath(mcp))
    if not os.path.exists(profile):
        os.makedirs(os.path.dirname(profile), exist_ok=True)
        with open(profile, "w", encoding="utf-8") as f:
            f.write(BLOCK.format(mcp=mcp, cwd=cwd))
        return "creado", profile

    with open(profile, encoding="utf-8") as f:
        lines = f.read().splitlines()

    changed = False
    mcp_line = -1
    for i, ln in enumerate(lines):
        if re.match(r"^\s*-\s+.*mcp-colab\.mjs\s*$", ln):
            mcp_line = i
            indent = re.match(r"^(\s*)", ln).group(1)
            lines[i] = "%s- %s" % (indent, mcp)
            changed = True
            break

    if mcp_line >= 0:
        for j in range(mcp_line, min(mcp_line + 8, len(lines))):
            if re.match(r"^\s*cwd\s*:", lines[j]):
                indent = re.match(r"^(\s*)", lines[j]).group(1)
                lines[j] = "%scwd: %s" % (indent, cwd)
                changed = True
                break
    else:
        while lines and not lines[-1].strip():
            lines.pop()
        lines.append(BLOCK.format(mcp=mcp, cwd=cwd).rstrip("\n"))
        changed = True

    if changed:
        with open(profile, "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
    return ("actualizado" if changed else "sin cambios"), profile


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mcp", required=True, help="ruta absoluta de mcp-colab.mjs")
    ap.add_argument("--profile", default=DEFAULT_PROFILE)
    a = ap.parse_args()
    if not os.path.exists(a.mcp):
        print("ERROR: no existe", a.mcp)
        return 1
    estado, ruta = patch(a.profile, a.mcp)
    print("perfil MCP %s: %s" % (estado, ruta))
    print("  mcp : %s" % a.mcp)
    print("  cwd : %s" % os.path.dirname(os.path.abspath(a.mcp)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
