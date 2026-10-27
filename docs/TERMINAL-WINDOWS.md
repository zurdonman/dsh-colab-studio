# Terminal Linux en Windows + lanzadores de doble clic

Objetivo: **que en Windows todo funcione "sin más"**, con los mismos `.sh` que
usamos en Termux, y que además se pueda lanzar **a golpe de clic** (doble clic
en un `.bat`).

---

## 1. Tres formas de tener "una terminal Linux" en Windows

| Opción | Qué es | Requiere admin | Ideal para |
|---|---|---|---|
| **A. WSL** | Linux de verdad (Ubuntu) dentro de Windows | Sí (una vez) | Ejecutar los `.sh` **exactamente igual** que en el móvil |
| **B. Git Bash** | Bash ligero que trae Git for Windows | No | Instalar sin permisos de admin y usar `.sh` |
| **C. PowerShell** | El nativo de Windows | No | Lo que ya hay en el repo: `.ps1` y `.cmd` |

Los lanzadores `.bat` detectan A → B → C solos. Tú no eliges: haces clic y
funciona.

---

## 2. Opción A — WSL (recomendada si quieres el `.sh` idéntico)

### Instalar

```powershell
wsl --install -d Ubuntu
```

(Reinicia el PC si lo pide.) La primera vez te crea un usuario Linux con su
propio `home`. Dentro de WSL instala lo que necesita el panel:

```bash
# dentro de WSL (Ubuntu)
sudo apt update && sudo apt install -y curl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
npm i -g google-colab-cli
colab auth login
```

O con `nvm` (más limpio):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 22
npm i -g google-colab-cli
```

### Instalar el panel dentro de WSL

```bash
cd ~
git clone https://github.com/zurdonman/dsh-colab-studio.git
cd dsh-colab-studio
bash install.sh          # deja el panel en ~/DSH Colab Studio
bash "$HOME/DSH Colab Studio/panel.sh" start
```

WSL2 reenvía `localhost`: desde el navegador de Windows abres
<http://127.0.0.1:8787> y ves el panel.

> ⚠️ La skill y el MCP de DSH están en el **lado de Windows** (`%USERPROFILE%\.dsh`),
> no dentro de WSL. El panel y la skill se hablan por `http://127.0.0.1:8787`,
> así que da igual dónde corra cada uno: mientras el panel escuche en 8787, DSH
> (en Windows) lo encuentra.

---

## 3. Opción B — Git Bash (sin permisos de admin)

1. Instala **Git for Windows**: <https://git-scm.com/download/win> (deja el
   "Git Bash" en el menú Inicio).
2. Instala **Node.js** para Windows: <https://nodejs.org> (LTS).
3. Abre Git Bash y comprueba:

```bash
node -v
npm -v
```

4. Instala el CLI de Colab (desde Git Bash o desde CMD):

```bash
npm i -g google-colab-cli
colab auth login
```

5. Clona e instala:

```bash
cd ~
git clone https://github.com/zurdonman/dsh-colab-studio.git
cd dsh-colab-studio
bash install.sh
bash "$HOME/DSH Colab Studio/panel.sh" start
```

### Limitaciones de Git Bash (y cómo las hemos resuelto)

| Falta | Qué pasa | Arreglo en este repo |
|---|---|---|
| `pgrep` / `pkill` | `command not found` | `panel.sh` usa un **fichero de PID** (`panel.pid`) en vez de `pgrep` |
| `nohup` | existe, pero el proceso muere al cerrar la ventana | `panel.sh start` deja el servidor desacoplado; en Git Bash usa `INICIAR-PANEL.bat`, que lo lanza con `Start-Process` de Windows |
| `python3` | suele llamarse `python` o no estar | los `.sh` usan **Node** (`panel_run.mjs`, `live.mjs`) y solo recurren a Python como plan B |
| Rutas | Git Bash usa `/c/Users/...`, Windows usa `C:\Users\...` | los `.bat` convierten la ruta con `wslpath` (WSL) o con barras invertidas (Git Bash) |

---

## 4. Los `.bat` de doble clic

Después de instalar, en la carpeta del repo (y también en la carpeta instalada)
tienes estos ficheros. **Doble clic y listo**:

| Fichero | Qué hace |
|---|---|
| `INSTALAR.bat` | Instala panel + skill + puente MCP en tu DSH de Windows |
| `INICIAR-PANEL.bat` | Arranca el panel y abre el navegador en `http://127.0.0.1:8787` |
| `INICIAR-PANEL-SH.bat` | Arranca el panel **con el `.sh` de verdad** (WSL/Git Bash), con la salida en el terminal |
| `PARAR-PANEL.bat` | Para el panel local (no toca las sesiones de Colab) |
| `TERMINAL-LINUX.bat` | Abre una terminal Linux (WSL → Git Bash → PowerShell) en la carpeta del panel |
| `EJECUTAR-SH.bat` | Ejecuta **cualquier `.sh`**: doble clic y arrastra el `.sh` encima, o `EJECUTAR-SH.bat script.sh` |

### Ejecutar un `.sh` cualquiera a golpe de clic

1. Doble clic en `EJECUTAR-SH.bat` **y arrastra encima tu `.sh`**.
2. O: abre `TERMINAL-LINUX.bat` y escribe `bash mi_script.sh`.

### Añadir un `.bat` propio

Copia esta plantilla y cambia lo que quieras:

```bat
@echo off
setlocal
chcp 65001 >nul 2>&1
set "DIR=%~dp0app"
if not exist "%DIR%\server.mjs" set "DIR=%~dp0"
set "DIRF=%DIR:\=/%"
where wsl.exe >nul 2>&1
if errorlevel 1 goto try_git
set "WSLDIR="
for /f "delims=" %%p in ('wsl.exe wslpath -a "%DIR%" 2^>nul') do set "WSLDIR=%%p"
if not defined WSLDIR set "WSLDIR=%DIR:\=/%"
wsl.exe --cd "%WSLDIR%" bash -lc "bash mi_script.sh"
goto fin
:try_git
set "GITBASH="
if exist "%ProgramFiles%\Git\bin\bash.exe" set "GITBASH=%ProgramFiles%\Git\bin\bash.exe"
if not defined GITBASH if exist "C:\Program Files (x86)\Git\bin\bash.exe" set "GITBASH=C:\Program Files (x86)\Git\bin\bash.exe"
if not defined GITBASH if exist "%LOCALAPPDATA%\Programs\Git\bin\bash.exe" set "GITBASH=%LOCALAPPDATA%\Programs\Git\bin\bash.exe"
if not defined GITBASH goto fin
"%GITBASH%" -c "cd '%DIRF%'; bash mi_script.sh"
:fin
echo.
pause
```

---

## 5. Equivalencias de un archivo a otro

| Qué quieres | Linux/Termux | Windows (sin terminal Linux) | Windows (con terminal Linux) |
|---|---|---|---|
| Arrancar el panel | `bash panel.sh start` | `panel.cmd start` | `bash panel.sh start` |
| Parar el panel | `bash panel.sh stop` | `panel.cmd stop` | `bash panel.sh stop` |
| Estado | `bash panel.sh status` | `panel.cmd status` | `bash panel.sh status` |
| Comando en vivo | `bash panel_run.sh "cmd"` | `panel_run.ps1 "cmd"` | `bash panel_run.sh "cmd"` |
| Hito «En directo» | `bash live.sh "texto"` | `live.ps1 "texto"` | `bash live.sh "texto"` |
| Descarga automática | `watcher_descarga.py` | `watcher_descarga.py` (necesita Python) | `python3 watcher_descarga.py` |

Todos hablan con la misma API (`http://127.0.0.1:8787`), así que da igual por
dónde los llames.

---

## 6. DSH en Windows y el puente MCP

El MCP (`mcp-colab.mjs`) es un proceso Node que habla JSON-RPC por stdio con
DSH. DSH lo lanza con `command: node` y `args: [ruta al .mjs]`.

- Si el panel corre **dentro de WSL**, el MCP puede seguir en Windows: se
  comunican por `127.0.0.1:8787` (WSL2 reenvía el puerto al host).
- Para reapuntar la ruta tras mover la instalación:

```powershell
powershell -ExecutionPolicy Bypass -File tools\patch_mcp.ps1 -Mcp "%USERPROFILE%\DSH Colab Studio\mcp-colab.mjs"
```

- Si prefieres que **todo** (MCP incluido) viva en WSL, cambia en
  `cordis.patch.yml`:
  - `command: wsl.exe`
  - `args: ["--cd", "/mnt/c/Users/<TU-USUARIO>/DSH Colab Studio", "bash", "-lc", "node mcp-colab.mjs"]`

---

## 7. Problemas frecuentes

**`node: command not found` en Git Bash.**
Node está instalado pero el PATH de Git Bash es antiguo: cierra Git Bash,
vuelve a abrirlo. Si sigue: `export PATH="$PATH:/c/Program Files/nodejs"`.

**`bash: panel.sh: Permission denied`.**
`chmod +x *.sh` o llámalo con `bash panel.sh ...` (no hace falta permiso de
ejecución).

**El panel arranca pero "Colab no disponible".**
El CLI no está en el PATH del proceso: `npm i -g google-colab-cli` y **abre una
terminal nueva**. En WSL, `npm i -g` a veces necesita
`sudo npm i -g` o reconfigurar el prefix de npm.

**WSL: `wslpath` no existe.**
WSL antiguo: el `.bat` cae a la conversión manual `/mnt/c/...`. O instala WSL
con `wsl --update`.

**El puerto 8787 está ocupado.**
`set COLAB_PANEL_PORT=8899` antes de arrancar, y abre ese puerto.
