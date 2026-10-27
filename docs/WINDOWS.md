# Instalar y usar DSH Colab Studio en Windows

Resumen rápido:

```powershell
git clone https://github.com/zurdonman/dsh-colab-studio.git
cd dsh-colab-studio
powershell -ExecutionPolicy Bypass -File install.ps1
npm i -g google-colab-cli
colab auth login
& "$env:USERPROFILE\DSH Colab Studio\panel.cmd" start
```

Abre <http://127.0.0.1:8787> y reinicia DSH para que cargue la skill.

---

## 1. Requisitos

| Qué | Versión | ¿Obligatorio? | Comprobación |
|---|---|---|---|
| Node.js | 20 o superior | **Sí** | `node -v` |
| npm | el que venga con Node | **Sí** (para el CLI de Colab) | `npm -v` |
| google-colab-cli | la última | **Sí** | `colab version` |
| Python 3 | cualquiera | **No** | — |

**No necesitas Python.** El panel es Node.js puro. Los scripts auxiliares
tienen versión PowerShell (`panel_run.ps1`, `live.ps1`, `tools/patch_mcp.ps1`),
así que el instalador funciona sin Python. (Python sí se usa en el móvil/Termux,
donde `bash panel_run.sh` delega en `panel_run.py`; y en los scripts que se
ejecutan **dentro de Colab**, que corren en el servidor, no en tu PC.)

El CLI de Colab es un paquete npm. Al instalarlo globalmente deja `colab.cmd`
en `%APPDATA%\npm` (o en la carpeta global de npm). El panel lo busca solo en
esa ruta, pero si lo tienes en otro sitio:

```powershell
set COLAB_BIN=C:\ruta\a\colab.cmd
```

…en la terminal desde la que lanzas el panel.

## 2. Instalador

`install.ps1` hace tres cosas:

1. Copia `app/` a `%USERPROFILE%\DSH Colab Studio`.
2. Copia `skills/panel-colab.md` a `%USERPROFILE%\.dsh\skills\`.
3. Reapunta el puente MCP en `%USERPROFILE%\.dsh\profiles\web\cordis.patch.yml`
   para que use las rutas de Windows en vez de las del móvil.

Opciones:

```powershell
powershell -ExecutionPolicy Bypass -File install.ps1 -InstallDir "D:\ColabStudio"
powershell -ExecutionPolicy Bypass -File install.ps1 -SkillDir "D:\dsh\skills"
powershell -ExecutionPolicy Bypass -File install.ps1 -SkipMcp
```

## 3. Puente MCP

Bloque que debe quedar en `cordis.patch.yml` (el instalador lo escribe solo):

```yaml
- insert:
    - id: mcp-colab-studio
      name: "@deepseek-ai/dsh-mcp-client"
      config:
        serverName: colab-studio
        transport: stdio
        command: node
        args:
          - C:\Users\<TU-USUARIO>\DSH Colab Studio\mcp-colab.mjs
        cwd: C:\Users\<TU-USUARIO>\DSH Colab Studio
        failOnStartupError: false
        toolCallTimeoutMs: 120000
```

Reinicia DSH para que lo cargue. Si no aparece el servidor, comprueba que
`node "C:\...\mcp-colab.mjs"` arranca sin error (habla JSON-RPC por stdio).

## 4. Permisos de PowerShell

Si `ExecutionPolicy` bloquea los scripts:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

o, sin cambiar la política, llama siempre con
`powershell -ExecutionPolicy Bypass -File ...`.

## 5. Diferencias con Termux (lo único que cambia)

| Cosa | Termux / Android | Windows |
|---|---|---|
| Carpeta del panel | `/storage/emulated/0/Download/Panel Google Colab` | `%USERPROFILE%\DSH Colab Studio` |
| Skill | `~/.dsh/skills/panel-colab.md` | `%USERPROFILE%\.dsh\skills\panel-colab.md` |
| Arranque | `bash panel.sh start` | `panel.cmd start` |
| Ejecución en vivo | `bash panel_run.sh "cmd"` | `powershell -ExecutionPolicy Bypass -File panel_run.ps1 "cmd"` |
| Descargas | `/storage/emulated/0/Download/pruebas generated` | `%USERPROFILE%\Downloads\pruebas generated` |
| Celdas DSH | `/storage/emulated/0/Download/rensi colabdsh` | `%USERPROFILE%\Documents\DSH Colab Studio` |
| `/tmp` | no existe | `%TEMP%` (el panel usa `os.tmpdir()`) |
| Token de Google | `~/.config/colab-cli/token.json` | `%USERPROFILE%\.config\colab-cli` o `%APPDATA%\colab-cli` |

La API, la UI y la skill son las mismas.

## 6. Problemas frecuentes

**El panel arranca pero dice «Colab no disponible».**
El CLI no está instalado o no está en el PATH del proceso del panel.
Comprueba `colab version` en la MISMA terminal desde la que lanzas el panel, o
define `COLAB_BIN`.

**«Node.js v20+» o `Cannot find module`.**
Instala Node LTS desde nodejs.org y reinicia la terminal.

**El puerto 8787 está ocupado.**
`set COLAB_PANEL_PORT=8899` y abre ese puerto.

**El MCP no responde.**
Comprueba que el panel está encendido (`panel.cmd status`) y que la ruta en
`args:` existe. `failOnStartupError: false` hace que DSH no se caiga si el MCP
falla, pero las herramientas MCP aparecerán sin funcionar.

**Se corta la sesión de Colab a mitad de una generación.**
Falta el keepalive (botón «🔒 Mantener runtime vivo») o has lanzado un
`colab exec` mientras generaba. Ver `docs/API.md`.
