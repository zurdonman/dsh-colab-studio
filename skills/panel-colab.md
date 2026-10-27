---
name: panel-colab
description: "Panel de Google Colab (DSH Colab Studio): cómo abrirlo, autenticar Google, crear/cerrar sesiones Colab, ejecutar código en el runtime, ver el panel EN DIRECTO, scripts en Celdas DSH y control de costes. Usar cuando el usuario mencione 'panel', 'panel de Google Colab', 'Colab Studio' o pida trabajar con Colab desde el panel."
whenToUse: "El usuario pide usar el panel de Google Colab, la aplicación de Colab, abrir/crear sesiones desde el panel, ejecutar scripts visibles en Celdas DSH, ver qué está haciendo el agente en directo, o revisar costes/saldo de Colab."
---

# Skill: Panel de Google Colab (DSH Colab Studio)

## Qué es y cómo abrirlo
- Servidor local: `http://127.0.0.1:8787` (nunca confundir con la web DSH `http://127.0.0.1:3080` — esa NO se reinicia jamás).
- Control en **móvil/Termux**: `cd "/storage/emulated/0/Download/Panel Google Colab" && bash panel.sh start|stop|restart|status`
- Control en **Windows**: `panel.cmd start|stop|restart|status` (o `powershell -ExecutionPolicy Bypass -File panel.ps1 start`). Ver sección «WINDOWS» más abajo.
- Si las APIs responden vacío, el panel está apagado → arrancarlo.
- Estructura: `server.mjs` (API), `public/` (UI), `ROADMAP.md` (fases), `RESUMEN.md` (estado vivo del proyecto), `prueba/` (logs y helpers).
- Rutas configurables por variable de entorno: `COLAB_PANEL_PORT` (8787), `COLAB_PANEL_DLDIR` (destino de descargas), `COLAB_PANEL_WORKDIR` (carpeta de Celdas DSH), `COLAB_BIN` (ruta al ejecutable `colab`), `COLAB_PANEL_URL` (para los helpers).

## WINDOWS (DSH en PC)
El panel es el mismo; lo que cambia son rutas y scripts. **No assumes rutas de Termux en Windows.**
- Instalación: clonar el repo → `powershell -ExecutionPolicy Bypass -File install.ps1` → deja el panel en `%USERPROFILE%\DSH Colab Studio` y la skill en `%USERPROFILE%\.dsh\skills\panel-colab.md`.
- Requisitos: Node.js 20+ (`node -v`) y el CLI `npm i -g google-colab-cli` (de ahí sale `colab.cmd`; el panel lo encuentra solo en `%APPDATA%\npm`).
- Arranque: `panel.cmd start` · estado: `panel.cmd status` · parar: `panel.cmd stop`. Panel en `http://127.0.0.1:8787`.
- Si `colab` no se encuentra: `set COLAB_BIN=C:\ruta\a\colab.cmd` o reinstala el CLI y abre una terminal nueva.
- Ejecución en vivo: `powershell -ExecutionPolicy Bypass -File panel_run.ps1 "comando" "etiqueta"`. En móvil: `bash panel_run.sh "comando" "etiqueta"`.
- Hitos «En directo»: `powershell -ExecutionPolicy Bypass -File live.ps1 "texto"` (móvil: `bash live.sh "texto"`).
- Rutas por defecto en Windows: descargas → `%USERPROFILE%\Downloads\pruebas generated`; Celdas DSH → `%USERPROFILE%\Documents\DSH Colab Studio`. Se cambian con `COLAB_PANEL_DLDIR` / `COLAB_PANEL_WORKDIR`.
- Token de Google: el CLI lo guarda en `%USERPROFILE%\.config\colab-cli` o `%APPDATA%\colab-cli`; el panel busca ambos.
- Puente MCP: `powershell -ExecutionPolicy Bypass -File tools\patch_mcp.ps1 -Mcp "%USERPROFILE%\DSH Colab Studio\mcp-colab.mjs"` reapunta `cordis.patch.yml` a la instalación nueva (en `~/.dsh/profiles/web/`). Reinicia DSH después.
- En Windows **no** existen `/storage/emulated/0/...` ni `/tmp`: usa `%USERPROFILE%`, `%TEMP%` y rutas con `\` (o `/` — Node las acepta).
- La UI y la API son idénticas: mismo `server.mjs`, mismos endpoints. Lo que se adapta es el arranque y las rutas.

## WINDOWS: terminal Linux y lanzadores de un clic
En Windows hay tres capas, y **el usuario puede usarlas indistintamente** porque todo habla con `http://127.0.0.1:8787`:
1. **PowerShell nativo** → `panel.cmd`, `panel_run.ps1`, `live.ps1` (lo que hay por defecto en el repo).
2. **Git Bash** (Git for Windows, sin admin) → los `.sh` tal cual: `bash panel.sh start`.
3. **WSL** (Linux real) → los `.sh` idénticos al móvil: `wsl --install -d Ubuntu`, y dentro `npm i -g google-colab-cli`.
- Los `.sh` de este repo **no dependen de `pgrep`/`pkill`** (Git Bash no los trae): usan un fichero `panel.pid`. Y usan **Node** (`panel_run.mjs`, `live.mjs`) en vez de Python, así que no hace falta Python.
- `.bat` de doble clic en la raíz del repo: `INSTALAR.bat`, `INICIAR-PANEL.bat`, `INICIAR-PANEL-SH.bat`, `PARAR-PANEL.bat`, `TERMINAL-LINUX.bat` (abre WSL → Git Bash → PowerShell, en ese orden) y `EJECUTAR-SH.bat` (ejecuta cualquier `.sh`: doble clic y arrastrar el `.sh` encima).
- Al instalar con `install.ps1`, los `.bat` se copian también a la carpeta instalada → `%USERPROFILE%\DSH Colab Studio`.
- Si el panel corre dentro de WSL, el MCP de DSH puede seguir en Windows: se hablan por `127.0.0.1:8787` (WSL2 reenvía el puerto). Reapuntar rutas: `powershell -ExecutionPolicy Bypass -File tools\patch_mcp.ps1 -Mcp "<ruta>\mcp-colab.mjs"`.
- Guía completa: `docs/TERMINAL-WINDOWS.md` del repo.

## Autenticación Google (OAuth caduca a veces)
1. `POST /api/auth/status` → `{"authorized":false}` = caducada.
2. `POST /api/auth/start` → devuelve `requestId` + **URL de accounts.google.com** (¡usar SIEMPRE la URL de ESTA respuesta, no la de status: PKCE/state distintos!).
3. El usuario abre la URL, aprueba y **pega el código** en el chat (o en la caja del panel).
4. `POST /api/auth/submit {requestId, code}` (misma requestId) → `ok:true`; verificar `POST /api/auth/status` → `authorized:true`.
5. Timeout del proceso de auth del panel: actuar en minutos, o repetir start.

## Sesiones Colab (CLI google-colab-cli 0.7.4)
- Crear: `colab new -s <nombre> --gpu L4` (alias SOLO con `-s`; L4≈1,54 ud/h, T4≈1,07, CPU≈0,08). ~4 min → `colab sessions`.
- Listar/saldo: `colab sessions` · `colab usage` (balance, Usage rate, Active assignments).
- Ejecutar: `colab exec -s <sesion> -f archivo.py` o vía panel `POST /api/notebook/source-exec {source}` (timeout 600 s).
- **`colab exec` corta a los 30 s por defecto** → siempre `--timeout 3600` (el panel ya lo pone). Sin eso cualquier script largo muere a medias.
- Ficheros del runtime: la Contents API del CLI (`colab ls/download`) ve el **Drive, no /content** → no sirve para bajar /content. SSH no está expuesto en estos runtimes. Para sacar un fichero al móvil: base64 por stdout (ver "REGLA DEL USUARIO" más abajo).
- Las sesiones mueren por inactividad (~20 min) → activar keepalive.
- Subir/bajar: `colab upload <local> <remoto>` / `colab download -s <sesion> <remoto> <local>`.
- Cerrar: `colab stop -s <sesion>` → verificar `No active sessions` + rate 0.00 y reportar **delta de balance**.
- QUIRKS: la respuesta del CLI puede llegar con `rc=3` pese a éxito (~450 s); reintentar con bucles (3 intentos, 5 s); tras OAuth caducada, TODOS los comandos piden código.
- Regla del usuario: **NO cerrar la sesión hasta que la prueba funcione o lo pida**; coste reportado siempre.

## REGLA DEL USUARIO: todo se ejecuta EN VIVO dentro del panel (no hay que volver a explicárselo)
Pido cualquier generación (vídeo, imagen, 3D, análisis) y el usuario la quiere ver **en directo en la celda "▶ Ejecución" del panel**, con el log saliendo línea a línea y un 0-100 % que se mueva.
1. **Ejecutar SIEMPRE a través del panel** (nunca `colab exec` a pelo en la terminal, porque su salida no se ve en el panel):
   - `POST /api/exec/script {session, file, label, timeout}` → ejecuta un `.py` y su stdout entra en vivo en **"Ejecución"** y en el **"Registro"**.
   - `bash panel_run.sh "comando shell" "etiqueta"` → cualquier otro comando, también en vivo (helper del Panel).
   - Desde la UI: `.py` de "Celdas DSH" ▶ Ejecutar en Colab, o la caja "Comando local" de la vista Ejecución.
2. **El script debe narrar**: `print(..., flush=True)` en cada paso; una línea `PROGRESO x% | ...` por etapa (la barra 0-100 % del panel la detecta) y `paso N/M` (el panel lo muestra aparte). Si una etapa tarda >30 s, sacar líneas intermedias para que el log no parezca muerto.
   - **Log MILIMÉTRICO (petición explícita del usuario)**: instrumentar `callback_on_step_end` para imprimir CADA paso de difusión (`paso i/N | t=... | PROGRESO xx.xx% | seg`) → la barra avanza paso a paso, no de 15 % en 15 %. Añadir además un hilo de "heartbeat" que imprita cada ~8-10 s (`⏱ elapsed | paso i/N | tramo k/4 | % | VRAM`) para que se vean pasar los segundos aunque el paso en curso dure.
   - El `PROGRESO` se calcula con decimales (`%.2f%%`) para que el movimiento de la barra sea visible.
   - **LOG DE TODO LO QUE SE DESCARGA / CARGA (petición explícita del usuario: "en las cargas de los pesos que se vea cómo sube la barra poco a poco, todas las cargas del script")**: ver la sección "LOG DE CARGAS" más abajo. Regla de oro: **ninguna barra puede depender de `\r`** (el panel los recorta) → siempre imprimir una **línea nueva** cada 1-3 s con `PROGRESO xx.xx%`, para que se vea subir poco a poco Y para que la barra del panel (#execBar) se llene también durante la carga.
3. **Keepalive siempre**: `POST /api/runtime/keepalive {session, on:true}` (o botón "🔒 Mantener runtime vivo" en la vista Runtime) → ping al kernel cada 4 min; sin esto Colab libera el runtime y se pierde el trabajo.
4. **Descarga automática al móvil** (obligatoria, el usuario la pidió explícitamente): el runtime no se baja con la Contents API → sacar el fichero por **base64**: script `37_descargar_b64.py` (imprime `B64_META` / `B64CHUNK` / `B64_END`); el panel detecta ese bloque y lo guarda solo en `/storage/emulated/0/Download/pruebas generated/`. Llamar a `/api/exec/script` con `quiet:true` para que el base64 no inunde la vista.
   - Plantilla lista: `38_historia_1min_autodownload.py` (el script se transfiere al final).
   - `watcher_descarga.py` (en la carpeta del Panel) vigila la ejecución y, al terminar, descarga + cierra la sesión sin intervención.
5. **NO reiniciar el panel durante una generación**: mata el log en vivo y puede romper la descarga. Los cambios de UI (public/) sí se aplican recargando el navegador (F5) sin reiniciar el servidor.
6. **Avisar cada 10 min** del % exacto de progreso (el usuario lo espera) y al final: fichero guardado, sesión cerrada y **saldo/coste**.

## LOG DE CARGAS (todo lo que se descarga/carga, en vivo y milimétrico)
El usuario quiere ver **subir cada barra poco a poco**: descarga del modelo, descarga de pesos (shards), carga de cada componente del pipeline, instalación de dependencias. **El panel NO muestra las barras de `tqdm`** porque las actualizan con `\r` y `lineFilter` las recorta → hay que imprimir **líneas nuevas** con el % (el panel usa el último `PROGRESO x%` para mover su barra 0-100 %).

**Helper universal (pegar en TODO script de generación)** — una barra por hilo que escribe una línea cada 1-3 s:
```python
import os, time, threading, glob

def _hub_bytes():
    tot = 0
    for root, _, files in os.walk(os.path.expanduser("~/.cache/huggingface/hub")):
        for f in files:
            try: tot += os.path.getsize(os.path.join(root, f))
            except OSError: pass
    return tot

class Barra(threading.Thread):
    """Barra REAL en lineas nuevas (compatible con el panel)."""
    def __init__(self, etiqueta, total=None, cada=2.0, base=None):
        super().__init__(daemon=True)
        self.etiqueta, self.total, self.cada = etiqueta, total, cada
        self.base = _hub_bytes() if base is None else base
        self.t0 = time.time(); self._stop = threading.Event()
    def stop(self): self._stop.set()
    def run(self):
        while not self._stop.is_set():
            d = max(0, _hub_bytes() - self.base)
            pct = (d / self.total * 100) if self.total else 0.0
            mb = d / 1e6
            print(f"[{self.etiqueta}] PROGRESO {pct:.2f}% | {mb:.1f} MB | {time.time()-self.t0:.0f}s", flush=True)
            self._stop.wait(self.cada)

def latido(cada=5.0, etiqueta="trabajando"):
    """Heartbeat: una linea cada 'cada' s con elapsed + VRAM (para fases sin barra)."""
    def _run():
        t0 = time.time()
        while True:
            v = 0.0
            try:
                import torch; v = torch.cuda.memory_allocated() / 1e9
            except Exception: pass
            print(f"[{etiqueta}] ⏱ {time.time()-t0:.0f}s | VRAM {v:.2f} GB", flush=True)
            time.sleep(cada)
    t = threading.Thread(target=_run, daemon=True); t.start(); return t
```

**Puntos donde SIEMPRE hay que poner barra/latido:**
1. **`pip install`**: usar `pip install --progress-bar off` y volcar la salida línea a línea con `subprocess.Popen(..., stdout=PIPE, stderr=STDOUT, text=True)` + hilo lector que hace `print(line, flush=True)`; si no, al menos `latido()` mientras instala.
2. **Descarga del modelo (los GB)**: `snapshot_download(repo_id, ...)` en un hilo + `Barra("descargando modelo", total=4_700_000_000, cada=2)` en paralelo (mide los bytes del caché HF). Alternativa: `HF_HUB_DISABLE_PROGRESS_BARS=1` y usar solo la Barra propia.
3. **Carga de los pesos (shards)**: parquear `safetensors.torch.load_file` para imprimir cada shard:
```python
import safetensors.torch, os
_orig = safetensors.torch.load_file
def _lf(filename, *a, **k):
    print(f"[pesos] cargando {os.path.basename(filename)}", flush=True)
    return _orig(filename, *a, **k)
safetensors.torch.load_file = _lf
```
   y arrancar `latido(5, "cargando pesos")` durante `from_pretrained` (imprime elapsed + VRAM mientras se leen los 4,7 GB).
4. **Carga de componentes del pipeline** (`Loading pipeline components 0/8`, `Loading weights 0/677`): son tqdm → invisibles → cubrir con `latido()`.
5. **Descarga al móvil (base64)**: durante el bloque B64, imprimir `PROGRESO` por cada chunk (`chunk i/N`) para que se vea avanzar la barra; el panel guarda el fichero al recibir `B64_END`.
6. **Regla**: cada fase larga (>30 s) debe emitir al menos una línea cada 5-10 s; si una fase no instrumenta, se ve como un log muerto.

## Celdas DSH (visible en el panel)
- Todo script que se trabaje va como `.py`/`.ipynb` en la **carpeta de trabajo**: en móvil `/storage/emulated/0/Download/rensi colabdsh/`, en Windows `%USERPROFILE%\Documents\DSH Colab Studio` (configurable con `COLAB_PANEL_WORKDIR`) → aparece como celda (los `.py` = UNA SOLA celda con ▶ Ejecutar en Colab).
- El panel expone la ruta buena en `POST /api/config` → `{workDir, dlDir, home, root, platform}`: **úsalo en vez de hardcodear rutas**.
- Marcadores de éxito en la salida: `ENLACE GRADIO: https://...` y `SCRIPT CONFIGURADO OK`; errores: `Traceback`/`---TB1---`.
- MCP: herramientas `mcp__colab-studio__*` (source-exec/patch/context) con `confirm:true`.

## En directo (lo que hace el agente, en tiempo real)
- Menú **● En directo** en el panel (UI) ← `POST /api/live` muestra la cola de `prueba/live.log`.
- El agente registra hitos con: móvil `bash live.sh "texto"` (en la carpeta del panel) · Windows `powershell -ExecutionPolicy Bypass -File live.ps1 "texto"`.

## Buenas prácticas de esta instalación
- Termux: NO existe `/tmp` (usar rutas en `Download/...`), sin symlinks, cuidado con espacios en rutas (comillas siempre).
- Apps Gradio en Colab: `python -u` + `PYTHONUNBUFFERED=1` (el búfer esconde el enlace) y `share=True`; el enlace muere al cerrar la sesión.
- Deps Colab 2026 (py3.13): para repos antiguos usar la dupla `diffusers==0.33.1 + transformers==4.46.2` con `pip --only-binary=:all:`; shim `PIL._typing._Ink`; borrar `torchao` viejo.
- Stack de vídeo que FUNCIONA (usar este, no el otro): `ai-server-mgr/LTX-2.5-Distilled-SDNQ-INT8-Transformer` con `LTX2ConditionPipeline` (diffusers de main) + `LTX2VideoCondition(frames=<último frame>, index=0, strength=1.0)` para encadenar + `num_frames=361, frame_rate=24.0` (15,0 s exactos) + `sigmas=DISTILLED_SIGMA_VALUES, guidance_scale=1.0` + `encode_video(video[0], fps=24, output_path=..., audio=audio[0].float().cpu(), audio_sample_rate=pipe.vocoder.config.output_sampling_rate)`. Requiere `pip install --upgrade git+https://github.com/huggingface/diffusers.git` + `sdnq>=0.2.2 av` + shim torchao (`FqnToConfig`) + HF_TOKEN.
- NO usar `LTXPipeline` de `Lightricks/LTX-Video`: su `__call__` no acepta `image=` (no encadena) y `num_frames` se redondea a 8k+1 (16→9 frames).
- **Guiones coherentes**: el usuario se quejó de que los 4 tramos no contaban nada (parkour → medieval → Coca‑Cola → Pepsi sin relación). Unir con UNA protagonista y una acción continua (misma descripción de personaje en los 4 prompts + el encadenado por `index=0` + frases de continuidad: "the same woman…", "she keeps running…") → es una historia, no 4 clips sueltos. Guion modelo: `39_historia_1min_coherente.py`.
- Al terminar: actualizar `RESUMEN.md` y `ROADMAP.md`; pedir veredicto del usuario antes de cerrar o iterar.

## COHERENCIA DEL VÍDEO (el usuario: "está bien pero falta más coherencia")
En la entrega del 27-10 16:30 el vídeo ya tenía protagonista constante pero la historia aún "saltaba" entre mundos y no se leía como una película. Reglas para la siguiente iteración:
1. **Descripción de protagonista LITERALMENTE IDÉNTICA** en los 4 prompts (copiar/pegar el mismo texto; cambiar un solo adjetivo ya rompe la identidad). Incluir el estado persistente: "wearing the same red windbreaker, the same grey backpack, the same white sneakers" → el encadenado no le cambia la ropa.
2. **Ancla de estilo repetida** en los 4 prompts para que parezca una sola película: misma luz, mismo objetivo, mismo movimiento de cámara y misma paleta ("cinematic, golden-hour sunlight, 35mm lens, shallow depth of field, subtle film grain, slow handheld camera, warm teal-and-orange grade"). Repetirla literalmente en cada prompt.
3. **La transición ocurre DENTRO del plano**, nunca como corte: el cambio de escenario (ciudad → medieval → máquina expendedora → lata gigante) se produce en los últimos segundos del tramo (destello, grieta de luz, salpicadura) y el primer frame del tramo siguiente es la continuación exacta de ese frame (encadenado `LTX2VideoCondition(frames=último_frame, index=0)`). Un tramo empieza exactamente "donde sale" el anterior.
4. **Misma semilla y mismos parámetros** en los 4 tramos (seed, `sigmas=DISTILLED_SIGMA_VALUES`, `guidance_scale=1.0`, `num_frames=361`, `frame_rate=24.0`) → misma textura y color.
5. **Plano medio con la protagonista grande** en todos los tramos (la identidad se pierde en planos abiertos/lejanos). Nada de plano general: la protagonista debe ocupar un tercio del encuadre.
6. **Un solo elemento clave por tramo** (1 acción + 1 objeto clave). Varios objetos a la vez → caos y mutaciones de identidad.
7. **No pedir logotipos**: los modelos no pintan logotipos reales (la máquina salió como un panel rojo genérico). Describirlo ("a glowing red soda vending machine", "a giant blue soda can") y, si el logo importa, ponerlo en post con ffmpeg.
8. **Verificar antes de entregar**: `ffmpeg -i out.mp4 -vf "fps=1/10,scale=384:256,tile=3x2" -frames:v 1 m.png` y comprobar que (a) la protagonista aparece en los 6 frames, (b) la paleta no cambia entre tramos, (c) la acción se entiende. Si un tramo falla → regenerar **solo ese tramo** y re-encadenar.
9. **Guardar el último frame de cada tramo** (`ultimo_frame_k.png`) → permite re-encadenar sin regenerar todo (ahorra CU y tiempo).
10. Si la coherencia sigue fallando: menos tramos más largos (2×30 s) o 1×60 s, y/o F2F (primer y último frame) en lugar de T2V encadenado.
- Al terminar: actualizar `RESUMEN.md` y `ROADMAP.md`; pedir veredicto del usuario antes de cerrar o iterar.

## ANUNCIO DE MARKETING (local comercial) — flujo probado
Pedido: "un anuncio de marketing para un salón de bodas, 45-60 s, 9:16, premium cinematográfico, solo el local, voz en off + texto, música orquestal, mediodía, solo español" → **3 pilotos** para enseñar al socio.
- **Motor**: `rensi colabdsh/45_motor_anuncio.py` (I2V 9:16 256x448, 4 planos x 361 frames = 60 s, barra de carga real, log por shard y por paso, transferencia base64 al móvil). Config por JSON en `/content/anuncio_cfg.json`.
- **Generar pilotos**: `46_generar_pilotos.py` crea un script por piloto (config + motor pegados) → `POST /api/exec/script` con ese fichero. **Un piloto por ejecución** (si muere la sesión, se repite solo ese).
- **Fotos del local**: `43_enviar_fotos.py` las empaqueta (zip+base64, conserva nombres) → `POST /api/exec/script` → quedan en `/content/fotos/`. `44_recortar_fotos.py` recorta la UI de las capturas de Google Maps/Instagram (recorte 9:16 центrado ya elimina los iconos de las esquinas).
- **Fidelidad del local**: cada plano se condiciona con su foto (`LTX2VideoCondition(frames=foto, index=0, strength=1.0)`), `fit="crop"` (encuadre 9:16) o `fit="pad"` (foto ancha completa sobre fondo desenfocado, para fachadas) → el sitio se ve real.
- **COHERENCIA (lo que pidió el usuario: "que entre clip y clip no haya música diferente ni otra voz")**: un mismo ancla de estilo literal en todos los prompts + mismo seed por piloto + **una sola pista de música y una sola voz para todo el anuncio** montadas en post (ffmpeg), silenciando el audio nativo de cada clip. Nunca dejar que el audio nativo varies entre planos.
- **Montaje final en el MÓVIL** (0 coste): `47_post_pilotos.py` → 1080x1920 (lanczos + realce + grado + viñeta), música con fundidos, voz con `adelay`, textos con `drawtext` y CTA final. Fuentes DejaVu disponibles en Termux.
- **Voz**: `edge-tts` funciona en Termux (`pip install edge-tts`) → una sola voz (`es-ES-ElviraNeural`) para todos los pilotos. En el móvil se genera antes de montar.
- **Verificar**: `ffprobe` (duración/frames) + mosaico `ffmpeg -vf "fps=1/10,scale=384:256,tile=3x2"` para ver que el local se mantiene y que no hay saltos raros.

## HALLAZGOS 27-10 18:00 (importantes)
- **El repo `LTX-2.5-Distilled-SDNQ-INT8-Transformer` pesa 51,63 GB** (no 4,7): text_encoder fp32 (25 GB) + connectors (10 GB) + transformer INT8 (20 shards) + vae. La descarga tarda ~3,5 min; el **tamaño exacto** se saca de la API: `HfApi().model_info(repo, files_metadata=True)` → suma de `siblings[i].size`.
- **El keepalive con `colab exec` MATA la sesión si hay una celda corriendo**: el exec se queda encolado detrás del kernel ocupado, agota su timeout y el CLI cancela la ejecución (así se perdió la sesión `ltx-ad` a mitad de generación). Arreglo aplicado en `server.mjs`: si hay una ejecución en curso, el ping usa `colab upload` (API de Drive, no toca el kernel); si no, usa `colab exec` con `torch.zeros`.
- **La barra de descarga debe ser MONOTONA**: los `.incomplete` de HF se borran y se rehacen → el % bajaba. Guardar el máximo visto (`self.best = max(self.best, medir())`).
- **Vertical 9:16 (256x448) funciona** con LTX-2.5: 8 pasos ≈ 7 s/paso; el primer paso de la primera llamada tarda ~3 min (offload + compilación). 4 planos ≈ 18-20 min.
- El audio nativo de LTX sale por clip y **cambia entre planos** → para anuncios, descartarlo y poner música+voz continuos en post.

## PROHIBIDO: execs secundarios mientras se genera (el fallo que colgó el piloto 2)
- **Nunca llamar a `/api/runtime/resources` (ni a `colab_runtime_resources` del MCP) mientras hay una generación en marcha.** Ese endpoint hace `colab exec` contra el kernel; si el kernel está ocupado, el exec se encola, agota su timeout (10 s) y el CLI lo reintenta: el servidor MCP llegó a lanzar **19 execs encolados** en 2 minutos y la celda de la generación quedó muerta (30+ min sin avanzar un solo paso).
- Lo mismo con cualquier `colab exec` que no sea el de la generación (ping de keepalive incluido). El ping de keepalive **ya** se hace por `colab upload` (API de Drive) cuando hay una ejecución en curso.
- Para ver el estado del runtime usa **solo el log del panel** (`/api/exec/current`) y `colab log -s <ses>` (que NO toca el kernel). `colab ls` tampoco lo toca.
- `colab restart-kernel -s <ses>` **mata la celda en curso** pero conserva el disco (la caché de 51,6 GB sigue ahí): es la forma de recuperar una generación colgada sin volver a descargar el modelo.
- El panel ya está parcheado: `/api/runtime/resources` devuelve `busy:true` sin ejecutar nada si hay una ejecución activa.
