# DSH Colab Studio

Panel local para usar **Google Colab desde DSH** (DeepSeek Harness) + la **skill**
`panel-colab` que enseña al agente a trabajar con ese panel.

Este repo contiene las dos piezas que necesitas para usar Colab en tu DSH de
**Windows** (y también en Termux/Android, que es donde se creó):

| Ruta | Qué es |
|---|---|
| `app/` | La aplicación del panel (servidor Node.js + UI web). |
| `skills/panel-colab.md` | La skill que se instala en DSH (`~/.dsh/skills/`). |
| `tools/patch_mcp.ps1` / `.py` | Reapunta el puente MCP de DSH a la instalación local. |
| `docs/` | Documentación extra (API, Windows). |

El panel es una app web local en `http://127.0.0.1:8787` que permite:
autorizar tu cuenta de Google, crear/cerrar runtimes GPU (T4/L4/A100/H100/CPU),
ver RAM/VRAM/almacenamiento en vivo, explorar y editar cuadernos, ejecutar
celdas y scripts viendo **la salida en directo**, y controlar el gasto.

> ⚠️ Ojo: `http://127.0.0.1:8787` es el panel de Colab. `http://127.0.0.1:3080` es la
> web de DSH — **no se reinicia nunca** y no se toca desde aquí.

---

## Requisitos

- **Node.js 20+** (`node -v`). En Windows: <https://nodejs.org> (incluye npm).
- **El CLI de Colab**: `npm i -g google-colab-cli` → deja el comando `colab`
  (`colab.cmd` en Windows, en `%APPDATA%\npm`). El panel lo encuentra solo.
- Autenticación de Google: `colab auth login` o el botón «Autorizar Google» del panel.

> **¿Python? No hace falta.** El panel es **Node.js/JavaScript** (`server.mjs` +
> HTML/CSS/JS planos, sin dependencias ni build). Python solo aparece en
> scripts auxiliares opcionales (`panel_run.py`, `live.py`, `watcher_descarga.py`)
> y en una versión equivalente del parcheador MCP. En Windows se usan los
> equivalentes en PowerShell (`panel_run.ps1`, `live.ps1`, `tools/patch_mcp.ps1`),
> así que **sin Python** te funciona todo.
>
> Los `.py` que el panel sube a Colab se ejecutan **allí** (en el runtime
> remoto), no en tu PC.

---

## Instalación en Windows (DSH en PC)

```powershell
git clone https://github.com/zurdonman/dsh-colab-studio.git
cd dsh-colab-studio
powershell -ExecutionPolicy Bypass -File install.ps1
```

El instalador deja:

- el panel en `%USERPROFILE%\DSH Colab Studio`
- la skill en `%USERPROFILE%\.dsh\skills\panel-colab.md`
- el puente MCP reapuntado en `%USERPROFILE%\.dsh\profiles\web\cordis.patch.yml`

Y luego:

```powershell
npm i -g google-colab-cli      # si no lo tenías
colab auth login                # o usa el botón «Autorizar Google» del panel
& "$env:USERPROFILE\DSH Colab Studio\panel.cmd" start
```

Abre <http://127.0.0.1:8787>. **Reinicia DSH** para que cargue la skill.

Instalación en otra carpeta:

```powershell
powershell -ExecutionPolicy Bypass -File install.ps1 -InstallDir "D:\ColabStudio" -SkipMcp
```

---

## Instalación en Termux / Android

```bash
git clone https://github.com/zurdonman/dsh-colab-studio.git
cd dsh-colab-studio
bash install.sh
bash "$HOME/DSH Colab Studio/panel.sh" start
```

---

## Uso diario

| Acción | Windows | Termux / Linux |
|---|---|---|
| Encender | `panel.cmd start` | `bash panel.sh start` |
| Estado | `panel.cmd status` | `bash panel.sh status` |
| Parar | `panel.cmd stop` | `bash panel.sh stop` |
| Comando en vivo (salida en el panel) | `powershell -ExecutionPolicy Bypass -File panel_run.ps1 "cmd" "etiqueta"` | `bash panel_run.sh "cmd" "etiqueta"` |
| Hito «En directo» | `powershell -ExecutionPolicy Bypass -File live.ps1 "texto"` | `bash live.sh "texto"` |

### A golpe de clic (Windows)

En la raíz del repo tienes unos `.bat` que lo hacen todo sin tocar la terminal.
Doble clic y listo:

| Doble clic en… | Qué hace |
|---|---|
| `INSTALAR.bat` | Instala panel + skill + puente MCP en tu DSH de Windows |
| `INICIAR-PANEL.bat` | Arranca el panel y abre el navegador en `http://127.0.0.1:8787` |
| `INICIAR-PANEL-SH.bat` | Arranca el panel con el `.sh` de verdad (WSL/Git Bash), con la salida en el terminal |
| `PARAR-PANEL.bat` | Para el panel local |
| `TERMINAL-LINUX.bat` | Abre una terminal Linux (WSL → Git Bash → PowerShell) en la carpeta del panel |
| `EJECUTAR-SH.bat` | Ejecuta **cualquier `.sh`**: doble clic y arrastra el `.sh` encima |

> `install.ps1` copia estos `.bat` también a `%USERPROFILE%\DSH Colab Studio`,
> así que los tienes a mano aunque no dejes el repo abierto.

### Terminal Linux en Windows

Los `.sh` del repo funcionan en Windows **sin tocar nada**, con cualquiera de
estas tres capas:

1. **PowerShell nativo** — `panel.cmd`, `panel_run.ps1`, `live.ps1` (lo que ya hay).
2. **Git Bash** (Git for Windows, sin admin) — `bash panel.sh start`, los `.sh` tal cual.
3. **WSL** (Linux real) — `wsl --install -d Ubuntu`, y dentro los `.sh` idénticos al móvil.

Los `.sh` están hechos para que todo esto funcione: usan un **fichero de PID**
en vez de `pgrep`/`pkill` (que Git Bash no trae) y **Node** en vez de Python
(`panel_run.mjs`, `live.mjs`), así que no necesitas Python ni `pgrep`.

Guía completa (instalar WSL, Git for Windows, cómo ejecutar un `.sh` arrastrándolo
sobre el `.bat`, equivalencias y problemas frecuentes):
[`docs/TERMINAL-WINDOWS.md`](docs/TERMINAL-WINDOWS.md).

---

## Configuración por entorno

| Variable | Por defecto | Para qué |
|---|---|---|
| `COLAB_PANEL_PORT` | `8787` | Puerto del panel. |
| `COLAB_PANEL_HOST` | `127.0.0.1` | Interfaz de escucha. |
| `COLAB_PANEL_DLDIR` | Windows: `%USERPROFILE%\Downloads\pruebas generated` · Android: `/storage/emulated/0/Download/pruebas generated` | Dónde se guardan las descargas automáticas (base64). |
| `COLAB_PANEL_WORKDIR` | Windows: `%USERPROFILE%\Documents\DSH Colab Studio` · Android: `/storage/emulated/0/Download/rensi colabdsh` | Carpeta de «Celdas DSH» (`.py`/`.ipynb`). |
| `COLAB_BIN` | automático | Ruta al ejecutable `colab` si no está en el PATH. |
| `COLAB_PANEL_URL` | `http://127.0.0.1:8787` | URL que usan `panel_run` y `live`. |

El panel también expone su configuración por API:

```bash
curl -s -X POST http://127.0.0.1:8787/api/config
# {"ok":true,"home":"...","workDir":"...","dlDir":"...","platform":"win32",...}
```

---

## Puente MCP (herramientas `mcp__colab-studio__*`)

El puente (`app/mcp-colab.mjs`) es un servidor MCP stdio que traduce las
herramientas de DSH a la API del panel:

| Herramienta MCP | Qué hace |
|---|---|
| `colab_notebook_context` | Lee una celda de un notebook local y sus salidas. |
| `colab_notebook_patch` | Cambia una celda con control de concurrencia (`confirm:true`). |
| `colab_execute_cell` | Ejecuta código en el runtime Colab (`confirm:true`). |
| `colab_runtime_status` | Estado del runtime. |
| `colab_runtime_resources` | RAM, VRAM y almacenamiento. |

Si al instalarlo en otro equipo las rutas del perfil siguen apuntando al móvil,
reapúntalas:

```powershell
powershell -ExecutionPolicy Bypass -File tools\patch_mcp.ps1 -Mcp "%USERPROFILE%\DSH Colab Studio\mcp-colab.mjs"
```

(equivalente en Python, por si prefieres: `python tools\patch_mcp.py --mcp ...`)

y reinicia DSH.

---

## Cómo está hecho

- `app/server.mjs` — servidor HTTP sin dependencias (solo Node built-ins). Sirve
  la UI de `app/public/` y expone `/api/*`. En Windows los ejecutables `.cmd`
  (como `colab.cmd`) se lanzan vía `cmd.exe` con los argumentos citados.
- `app/public/` — UI (HTML + JS + CSS planos, sin build).
- `app/mcp-colab.mjs` — puente MCP stdio.
- `skills/panel-colab.md` — la skill: qué hacer con el panel, cómo narrar los
  scripts (barras de progreso en líneas nuevas, nunca `\r`), cómo no colgar el
  runtime con execs secundarios, cómo bajar ficheros por base64, y los hallazgos
  sobre generación de vídeo con LTX-2.5.

Ver [`docs/API.md`](docs/API.md) para el detalle de cada endpoint y
[`docs/WINDOWS.md`](docs/WINDOWS.md) para notas específicas de Windows.

---

## Licencia

MIT — ver [`LICENSE`](LICENSE).
