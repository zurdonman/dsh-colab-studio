# RESUMEN — contexto rápido del proyecto (léerme antes de cada turno)

## Reglas del usuario
- **Todo script/ejecución = visible en Celdas DSH** (panel `127.0.0.1:8787`): `.py`/`.ipynb` en `rensi colabdsh/`, ejecución vía source-exec (mismos marcadores `ENLACE GRADIO:`/`SCRIPT CONFIGURADO OK`).
- Sesión Colab **solo se cierra cuando funcione o lo pida él**. Coste siempre reportado (saldo actual en `colab usage`).
- Progreso cada ~10-60 s en fases activas; **actualizaciones breves, pensamiento y tooling reducidos** (ahorrar tokens).
- Idioma: español, directo.

## Proyecto: vídeo "frame to frame" en Colab L4
- **Encargo actual**: app Gradio con **2 entradas: FRAME INICIO + FRAME FINAL** → modelo `Lightricks/LTX-Video` (2B) vía `LTXConditionPipeline` (diffusers 0.33.1, acepta `image=[ini,fin]` + `frame_index=[0,N-1]`). FramePack-F1 (anterior) solo admite primer frame.
- **Stack validado (NO tocar)**: `diffusers==0.33.1` + `transformers==4.46.2` + `gradio==5.23.0`, pip `--only-binary=:all:`, shim `PIL._typing._Ink`, borrar `torchao` viejo, `python -u` (sin búfer para ver URL), pidfile con `/proc/<pid>/cmdline`.
- **Script LTX**: `rensi colabdsh/ltx_inicio_final_colab.py` (COMPILE_OK; bug isatty ya corregido; subido ayer a `/content`, sesión posterior murió).
- **Demo validada ayer** (FramePack en L4): 73 frames/2,43 s/30 fps, 7,31 s/frame, VRAM pico 14,04 GiB. Evidencia: `Panel Google Colab/prueba/f2f_out/`.

## Ahora mismo (2026-10-21 16:20) — ✅ PRUEBA 1 COMPLETADA, SESIÓN CERRADA
- OAuth renovado (lección: URL de **start**, no de status — distinto PKCE/state). Panel con menú **● En directo** (`POST /api/live` → `prueba/live.log`; helper `bash live.sh "texto"`).
- **App LTX 2 entradas (FRAME INICIO + FRAME FINAL) VALIDADA end-to-end**: fixes: `scheduler use_dynamic_shifting=False` (pedía `mu`) + `p.to('cuda')` (se olvidó → iba en CPU). Script: `rensi colabdsh/ltx_inicio_final_colab.py`.
- **Prueba intento 1** (Big Buck Bunny → f1+f2 → 3,2 s, 30 pasos): **VIDEO_OK 42 s = 1,93 s/frame** (FramePack: 7,31 s/f → LTX 3,8× más rápido). Artefactos: `Download/prueba intento uno/` (mp4 526 KB + frame_1_inicio + frame_2_final + ltx_app.log + video_fuente).
- **Sesión cerrada y verificada**: `No active sessions`, rate 0.00. **Saldo 95,14 ud** (hoy: 95,70→95,14 = 0,56 ud; total viaje: 99,54→95,14 = 4,40 ud).

## Fixes del panel (2026-10-27 13:45)
- **Botón "Borrar / Refrescar"** en la vista *Ejecución* (`index.html` → `clearExecView()`): llama a `POST /api/exec/clear` (nuevo endpoint en `server.mjs` → `execRec = null` + borra `prueba/last_exec.json`), y además marca `state.execClearedAt` para que `refreshExecView()` ignore registros anteriores al borrado. Verificado con flujo simulado: ejecutar → borrar → esperar 4 s → sigue `null`.
- **Registro de actividad = salida real de celdas**: nueva función `logOutput(label, out, isError)` en `app.js`; `runCell`/`runNotebook`/`runScript` vuelcan ahí la salida completa (stdout+stderr) en vez de solo `r.stderr`.
- **Ruido "A new version of Colab CLI" eliminado**: filtro en servidor (`CLI_NOISE` + `stripNoise` + `lineFilter` en `runColab`) y en cliente (`NOISE_RE` en `log()`). Además `api()` ya no auto-loguea stderr de endpoints `/api/notebook/*` y `/api/exec/*` (doble log), y el polling de 5 s (sessions/status/usage) ya no inunda el Registro.
- **OJO**: `app.js` y `server.mjs` son de una línea larguísima — editar con scripts Python + `assert`, y SIEMPRE `node -c` tras editar (un edit mal aplicado rompió el panel el 27-10).

## Comandos clave
- Panel: `cd "/storage/emulated/0/Download/Panel Google Colab" && bash panel.sh start|status`
- Exec en sesión: `python3 prueba/f2f/colab_exec.py <sesion> <timeout> <script.py|/dev/stdin>` (3 reintentos, race ~450 s CLI)
- Estado: `colab sessions` · `colab usage` · subir: `colab upload <local> <remoto>` · bajar: `colab download -s <sesion> <remoto> <local>`
- Entregables finales pendientes: informe de costes + cierre sesión + ROADMAP (Fase 9 ya ✅ ayer).

## Mochila de pendientes (sin urgencia)
- Comparar LTX vs FramePack (velocidad/coherencia) si lo pide. Repo "que me pasó" sin confirmar (si no es LTX, que lo pegue).
- Carries: integración plugin DSH, Drive privado Fase 8, oferta edit-speed flux.

## 2026-10-21 — Pruebas LTX-2.5 3 modos (t2v/i2v/f2f) ✅ OK
- Modelo: `ai-server-mgr/LTX-2.5-Distilled-SDNQ-INT8-Transformer` (transformer 19.5GB ≤ 24GB, resto CPU offload, audio nativo)
- Sesión `pruebas-ltx` (L4), diffusers 0.42.0.dev0 (git main), sdnq 0.2.8, PyAV 19.0.2
- Offload: `enable_sequential_cpu_offload()` (el model_cpu_offload daba OOM a 21.6GB)
- Tiempos: T2V 210s, I2V 174s, F2F 176s (97f @768x448 24fps, 8 steps distilled) · VRAM pico 21.58GB
- Saldo: 88.68 → 87.11 CU (~1.57 CU total) · Salida: `Download/pruebas generada/{01,02,03}_*.mp4`
- OJO: caches de diffusers (`sdnq`, `av`) se parchean en runtime si se instalan tras el primer import
- TEST DIFERENCIADO (fotos Wikimedia reales): T2V gato-cocina 260s, I2V foto-gato 225s, F2F playa→bosque 217s · VRAM pico solo 3,09 GB con offload secuencial · keepalive (loop GPU hasta marker via API contents) evita perder mp4 al riclar runtime idle · outputs: 04/05/06_*.mp4 en pruebas generada/

## 2026-10-22 — F2F baile con fotos de la usuaria ✅ (sesión CERRADA)
- 07_f2f_baile.mp4 (Muybridge, seed 7, 219s) · 08_f2f_baile_mujer.mp4 (fotos reales usuaria, seed 11, 219s)
- Pipeline recarga en 15s con caché caliente; keepalive+marker probado 2x (cero clips perdidos)
- Balance final: 85.05 CU (inicio tanda 88.68 → total pruebas ≈ 3.63 CU); sess terminated, rate 0.00
- SIGUIENTE: app Gradio self-service (pendiente visto bueno de los 8 clips) + limpiar HF token de scripts locales

## 2026-10-22 02:2x — Estado: SESIONES CERRADAS (0 activas, rate 0.00, saldo 85.05 CU)
- App Gradio escrita y lista: rensi colabdsh/20_app_gradio.py (NO lanzada a proposito; lanzar = crear sesion L4 + exec del script -> imprime "ENLACE GRADIO: https://gradio.live/..." ~10-15 min runtime nuevo, ~3 min si caché caliente)
- CSV de tiempos: pruebas generada/tiempos_generacion.csv (~220s/clip, 0.09 CU/clip)

## 2026-10-22 03:5x — «⏻ Apagar sesiones» (página principal) listo y probado E2E
- El botón de la página principal apaga TODAS las sesiones Colab de la cuenta (no solo la seleccionada) y verifica el cierre: `No active sessions` + rate 0.00 + saldo en el toast de confirmación.
- Endpoint `POST /api/runtime/stop-all`: lista → stop de cada una → reintento → verificación (el `ok` solo es true si NO queda ninguna sesión).
- Fix: parsers de sesiones (server.mjs y app.js) ignoran los avisos `[colab] A new version…` del CLI 0.7.4; antes inventaban una sesión «colab» fantasma.
- E2E: `apagar-test` creada → apagada → saldo 84,29 ud intacto. Panel reiniciado (health 200); sesiones: 0 activas.

## 2026-10-22 04:2x — Visor de hardware reparado + vista «▶ Ejecución» persistente
- Hardware: sin sesión → mensaje claro «Sin runtime activo — crea o selecciona una sesión…» (antes quedaba congelado/mudo); con sesión → status + RAM/VRAM/almacenamiento con reintento ×3 en el servidor y aviso visible si faltan datos; `metric()` a prueba de ids ausentes.
- Vista «▶ Ejecución» (menú nuevo): salida en tiempo real SOLO de la celda en curso (nunca mezclada), etiqueta (archivo · celda i), estado/rc/duración, badge ● en el menú mientras corre; registro en servidor + disco (`prueba/last_exec.json`) → sobrevive a recargas de página y reinicios del panel; al pulsar ▶ se salta automáticamente a la vista.
- E2E (CPU `dsh-paneltest`): resources ✓ (RAM 818 MB/13,6 GB; VRAM null → «No disponible»), streaming ✓ (running con «paso 3» a mitad → LISTO_FIN, done), persistencia ✓ (603 B en disco), stop-all ✓ (0 sesiones, rate 0.00, saldo 84,19 → 84,19 ud).
- Sin sesiones abiertas al terminar.

## 2026-10-22 04:4x — Visor de hardware: causa raíz hallada y reparada + auto-refresh total
- Causa raíz: `split('\\n')` (literal doble) en resources tras la reescritura del servidor → `resources:null` siempre → «no da la información». Fix + verificación en vivo: 4,7 s, RAM 1,66/56,86 GB, VRAM 23,66 GB (L4), disco 45,5 GB.
- Auto-refresh: runtime+coste 5 s · sesiones 10 s · archivos 30 s · auth 60 s · Ejecución 1,5 s; sello «Actualizado HH:MM:SS» en el Inspector; single-flight+backoff (sin apilamiento de execs; la cola del kernel drenó de 20+ s a 4,7 s).
- RECIENTES clicable (abre en Celdas DSH) + persiste entre recargas (localStorage 'colab.recent').
- Nota: hay L4 propia del usuario encendida (dsh-colab, 1,54 ud/h; saldo 83,79) — apagable con «⏻ Apagar sesiones» cuando termine. Requiere F5 una vez para cargar el JS nuevo.

## 2026-10-22 05:0x — causa de los "muere al iniciar" RAIZ + FIX plug&play + SESION CERRADA
- Colab actualizo su imagen a Gradio 6.30 ROTA en Colab (Blocks.exited / formatter default)
- APP_LTX_Studio.py v4: el launcher fija gradio==5.49.1 + diffusers git + sdnq + av antes de lanzar; app embebida compilada OK; el pip del hilo motor eliminado (no duplicar)
- Verificacion launch share real con 5.49 quedo colgada (test, no app) -> matada; evidencia previa: clips generados esta manana con gradio 5.x
- dsh-colab terminated. Balance 83.28 (coste tanda app ~0.9 CU; total dia ~5.4 CU)

## 2026-10-22 05:3x — APP v5 VALIDADA plug&play (bug raiz: gradio roto + 'exited' enmascaraba)
- Fix: launcher desinstala gradio 6.x e instala 5.49.1 + demo.exited=False + stdout app->app.log (tqdm en Log web)
- Smoke real vía API: gen 97f en 279s OK; link 200; pipeline 218s en descarga fria 49GB
- dsh-colab sigue ABIERTA con caché caliente (reload ~15-60s); app apagada por si; proximo: usuario ▶ APP_LTX_Studio.py

## 2026-10-26 — v2 baile desde banco: 10_baile_sentado.mp4 (15s, 448s GPU, seed 555) OK
- FrameA compuesto (cara selfie grande sentada) → i2v; sesion baile2-l4 cerrada; saldo 80.39
- Pendiente veredicto usuario (identidad de cara)

## 2026-10-27 — ESTADO FINAL (chat a punto de compactarse)
- ✅ Receta buena: selfie REAL → i2v 361f/15s 448x768 (cara garantizada). Docs: rensi colabdsh/WORKFLOW_selfie_a_video.md; plantillas 32_*.py (maestra), 33_arma_cielo.py
- Clips entregados: 11_baile_cara_real.mp4 (aprobado), 12_arma_cielo.mp4 (aprobado) en pruebas generada/
- Saldo 79,49 CU · 0 sesiones activas · rate 0,00 · OAuth OK (caduca en días)
- Gen: 448s GPU con motor cargado; runtime nuevo +~19min total; L4 1,54 CU/h
- APP_LTX_Studio.py v5 (Gradio 5.49.1) validada para uso manual del usuario
- Pendiente: usuario revocar token HF hf_SWwM... incrustado en scripts

## 2026-10-27 14:15 — Panel: streaming en vivo de TODA ejecución + fix --timeout
- NUEVO `public/live-exec.js` (se carga tras app.js): polling 1,5 s a /api/exec/current -> vuelca cada línea nueva en la vista "Ejecución" Y en el "Registro" en vivo; barra de progreso 0-100 % (#execProgress/#execBar/#execPct), latido ("sin salida nueva hace N s"), paso N/M. NO tocar app.js (minificado).
- NUEVOS endpoints server.mjs: `POST /api/exec/run` {command|argv, shell, cwd, label, timeout} (cualquier comando local, sale en vivo) y `POST /api/exec/script` {session, file, label, timeout} (colab exec de un .py con salida en vivo).
- FIX CRÍTICO: `colab exec` corta a los 30 s por defecto -> todos los endpoints del panel pasan ahora `--timeout 3600`. Sin esto cualquier script largo muere.
- `lineFilter` ahora corta por \r (tqdm) para no acumular barras de progreso.
- Helper `panel_run.sh "comando" "etiqueta"` = ejecuta CUALQUIER cosa A TRAVES del panel (queda en Ejecucion+Registro). Usar SIEMPRE para que el usuario vea el log.
- Verificado: streaming incremental real (len 25->51->77... cada 1,6 s), test headless del cliente (Registro recibe linea a linea, barra 16 %, meta "paso 1/6"), panel_run OK, node -c OK en los 3 ficheros.
- AHORA: sesion `ltx-hist` (L4) creada; historia de 1 min = 45 fragmentos encadenados, 12 fps, 256x384, 15 pasos (~25 min). Script: rensi colabdsh/35_historia_1min_produccion.py. Descargar a /storage/emulated/0/Download/pruebas generated/13_historia_1minuto.mp4 y cerrar sesion (saldo 74,64 CU al inicio).

## 2026-10-27 15:00 — Hallazgos del día (importantes, no repetir)
- **LTX (`LTXPipeline` de `Lightricks/LTX-Video`) NO encadena**: su `__call__` no acepta `image=` (error: unexpected keyword argument 'image') y `num_frames=16` se redondea a **9** (LTX exige 8k+1) -> un "1 min" con 45 fragmentos salio de 33,8 s y sin continuidad.
- **Receta que SÍ funciona (LTX-2.5)**: `LTX2ConditionPipeline.from_pretrained("ai-server-mgr/LTX-2.5-Distilled-SDNQ-INT8-Transformer")` + `conds=[LTX2VideoCondition(frames=<ultimo frame>, index=0, strength=1.0)]` + `num_frames=361, frame_rate=24.0, sigmas=DISTILLED_SIGMA_VALUES, guidance_scale=1.0` + `encode_video(video[0], fps=24, output_path=..., audio=audio[0].float().cpu(), audio_sample_rate=pipe.vocoder.config.output_sampling_rate)`. 361f@24fps = 15,0 s exactos -> 4 tramos = 60,0 s. Condicionar index=0 con el ultimo frame del tramo anterior = continuidad real.
- Requisitos: `pip install --upgrade git+https://github.com/huggingface/diffusers.git` + `sdnq>=0.2.2 av` + shim torchao (`FqnToConfig`) + HF_TOKEN (hay uno incrustado en 32_/33_).
- **Descarga de ficheros del runtime**: la Contents API del CLI (`colab ls/download`) mira el DRIVE, NO el FS del runtime -> /content no existe ahi. SSH no expone `/colab/ssh` en estos runtimes. SOLUCION: sacar el fichero por stdout en base64 (37_descargar_b64.py) y reconstruir en local.
- Las sesiones Colab mueren por inactividad (~20 min sin uso) -> si esta quieto, recrear con `colab new -s <nombre> --gpu L4` (4 min).
- Script final: rensi colabdsh/36_historia_1min_final.py (4 tramos LTX-2.5) | transferencia: 37_descargar_b64.py

## 2026-10-27 15:55 — ✅ HISTORIA DE 1 MINUTO ENTREGADA (sin intervención manual)
- **ENTREGABLE**: "/storage/emulated/0/Download/pruebas generated/13_historia_1minuto.mp4" — 5.578.166 bytes, h264 384x256 @24fps, **1444 frames, 60,19 s**, con audio AAC (2820 muestras). Verificado con ffprobe.
- Generación: 4 tramos LTX-2.5 encadenados (361f cada uno, el último frame de un tramo condiciona el siguiente), 227-262 s por tramo, ~20 min total.
- **Descarga AUTOMÁTICA**: watcher_descarga.py (vigila la ejecución -> saca el MP4 por base64 -> lo guarda en el móvil -> cierra la sesión). Funcionó a la primera: 15:51:02 detecto fin, 15:51:11 fichero en el móvil, 15:51:15 sesión cerrada.
- Coste: 74,64 -> **72,68 CU** (-1,96 CU, las 2 sesiones L4 + ficheros). 0 sesiones activas, rate 0,00.
- Panel: keepalive (ping 4 min, POST /api/runtime/keepalive), auto-descarga por base64 en el servidor (B64CHUNK/B64_END), reloj de segundos + barra 0-100 % + latido en la vista Ejecución, watcher_descarga.py, panel_run.sh, 38_historia_1min_autodownload.py.
- Skill panel-colab.md ACTUALIZADA con la "REGLA DEL USUARIO: todo se ejecuta EN VIVO dentro del panel" (ejecutar vía /api/exec/script o panel_run.sh, script que narra con PROGRESO x%, --timeout 3600, keepalive, descarga por base64, no reiniciar el panel durante la generación, avisar cada 10 min).
- Pendiente (no urgente): SSE en el panel para que el reloj no se ralentice con la pestaña en segundo plano; reiniciar el panel para activar la auto-descarga del servidor (requiere reinicio, no se hizo durante la generación).

## 2026-10-27 16:30 — ✅ HISTORIA COHERENTE (2ª gen) ENTREGADA + AUTO-DESCARGA SERVIDOR
- **ENTREGABLE**: "/storage/emulated/0/Download/pruebas generated/13_historia_1minuto_coherente.mp4" — 5.254.155 bytes, h264 384x256 @24fps, **1444 frames, 60,19 s**, audio AAC 48 kHz estéreo. Verificado con ffprobe + mosaico de 6 frames.
- **Guion coherente** (`rensi colabdsh/39_historia_1min_coherente.py`): UNA protagonista (Vera, coleta negra, chaqueta roja, mochila gris) en los 4 tramos con acción continua: 1) parkour entre azoteas neón -> cae por una grieta luminosa · 2) aterriza en un campo de batalla medieval y sigue avanzando entre caballeros · 3) entre ruinas aparece una máquina expendedora de Coca-Cola luminosa y la toca · 4) una lata gigante de Pepsi cae del cielo y la aplasta en un estallido de líquido; ella se cubre y huye.
- **Log milimétrico**: `callback_on_step_end` imprime CADA paso (8 por tramo) con `paso i/8 | t=… | PROGRESO xx,xx% | elapsed`. Tramo 1: 259 s · tramo 2: 229 s. Total ~20 min. La barra del panel avanza 3,12 % por paso.
- **Auto-descarga SERVIDOR verificada**: el propio script imprime el MP4 en base64 (B64_META/B64CHUNK/B64_END) y el servidor lo escribe solo en `COLAB_PANEL_DLDIR` (por defecto "Download/pruebas generated"). 15:29:55 → "DESCARGA AUTOMATICA OK" + watcher_descarga.py de respaldo confirmó 5.254.155 bytes y cerró la sesión.
- **Keepalive** (ping 4 min con torch.zeros en CUDA) YA existe en el panel; se rearmó en ltx4 a mitad de run (el estado se vacía al reiniciar el panel).
- Coste: 72,46 -> **71,95 CU** (-0,51 CU). 0 sesiones activas, rate 0,00. Programación de avisos cada 10 min BORRADA al terminar.
- Skill panel-colab.md: regla de log por paso + heartbeat, coherencia del guion (misma protagonista + conectores), keepalive y auto-descarga.

## 27-10 2026 19:55 · PILOTOS DE ANUNCIO — Castell de Vilafortuny (Cambrils)
**Encargo**: anuncio de marketing (45-60 s, 9:16 vertical, premium cinematográfico, solo el local, voz en off + texto, música orquestal, mediodía, solo español) para enseñar a un socio. El local se identifica por las fotos: masía de piedra con torre, patio con fuente y bola de piedra, guirnaldas de luz, jardín y capilla.

**Material**: 10 fotos reales del local extraídas de capturas de Google Maps/Instagram (`44_recortar_fotos.py` recorta la UI; el encuadre 9:16 centrado ya elimina los iconos). Fotos: fachada/torre, patio con fuente, 4 frames de los novios bailando, 2 del pasillo de boda.

**Motor**: `45_motor_anuncio.py` (I2V LTX-2.5, 256x448, 4 planos x 361 frames = 60,0 s exactos, ancla de estilo literal en los 4 prompts, mismo seed por piloto, log por paso con PROGRESO %). `46_generar_pilotos.py` genera un script por piloto. `47_post_pilotos.py` monta en el móvil: 1080x1920 + una sola música + una sola voz + textos.

**Pilotos**:
1. `piloto1_castillo` — El Castillo (torre → fachada → fuente → boda). **Entregado**: 1080x1920, 60,2 s, h264+aac, 39 MB.
2. `piloto2_patio` — El Patio (patio → novios → fuente → beso).
3. `piloto3_boda` — La Boda (aéreo → ceremonia → baile → patio).

**Fallos resueltos**: (1) el parche de `safetensors.torch.load_file` se acumulaba en el kernel persistente de Colab y rompía la carga de pesos → se eliminó; (2) `colab exec` encolados contra un kernel ocupado (los del endpoint `/api/runtime/resources` vía MCP) mataron la celda → prohibido y panel parcheado; (3) la barra de descarga del modelo debe ser monótona (los `.incomplete` de HF se rehacen).

**Pendiente del cliente**: teléfono/web/logo y confirmación del nombre comercial para los textos finales (hoy: "CASTELL DE VILAFORTUNY · Bodas y eventos en Cambrils"). Aviso: las fotos de fachada/torre vienen de Google Street View (marca de agua) → para la versión comercial definitiva conviene usar fotografías propias del local.
