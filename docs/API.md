# API del panel (DSH Colab Studio)

Base: `http://127.0.0.1:8787`. Todos los endpoints son **POST** salvo `/api/health`
(GET o POST). Todos devuelven JSON `{ok:true, ...}` o `{ok:false, error:"..."}`.

## Estado y configuración

| Endpoint | Devuelve |
|---|---|
| `/api/health` | `colab version` — sirve de latido. |
| `/api/config` | `home`, `workDir`, `dlDir`, `root`, `platform`, `isWin`, `port`, `host`, `cli`, `node`. |

## Autenticación Google

| Endpoint | Body | Notas |
|---|---|---|
| `/api/auth/status` | — | `{authorized:bool, output}`. |
| `/api/auth/start` | — | `{requestId, stdout, stderr}` — la **URL de accounts.google.com** sale en `stderr`. |
| `/api/auth/submit` | `{requestId, code}` | Pega aquí el código que muestra Google. |
| `/api/auth/logout` | — | Cierra la cuenta guardando el token como `token.json.bak-*`. |
| `/api/auth/restore` | — | Restaura la copia más reciente. |

## Sesiones y runtime

| Endpoint | Body | Notas |
|---|---|---|
| `/api/sessions` | — | Lista de sesiones activas. |
| `/api/runtime/new` | `{session, gpu, highMem}` | `gpu` ∈ `CPU,T4,L4,A100,H100`. |
| `/api/runtime/status` | `{session}` | Estado del kernel. |
| `/api/runtime/stop` | `{session}` | Cierra una sesión. |
| `/api/runtime/stop-all` | — | Cierra todas + devuelve saldo y tasa. |
| `/api/runtime/keepalive` | `{session, on}` | Ping cada 4 min. |
| `/api/runtime/keepalive/status` | — | Estado del keepalive. |
| `/api/runtime/resources` | `{session}` | RAM/VRAM/almacenamiento. **Devuelve `busy:true` si hay una ejecución en curso** (no ejecuta nada). |
| `/api/runtime/url` | `{session}` | URL del runtime. |
| `/api/runtime/drive` | `{session}` | Monta Google Drive. |
| `/api/usage` | — | `{balance, rate, assignments}`. |

## Archivos

| Endpoint | Body | Notas |
|---|---|---|
| `/api/files/local` | `{path}` | Lista una carpeta local. |
| `/api/files/remote` | `{session, path}` | Lista en el runtime. |
| `/api/file/raw` | `{file}` | Lee un script (<1 MB). |
| `/api/file/save` | `{file, source}` | Guarda un script. |
| `/api/install` | `{session, packages}` | `pip install` en el runtime. |

## Ejecución (la vista «Ejecución»)

| Endpoint | Body | Notas |
|---|---|---|
| `/api/exec/run` | `{command \| argv, shell, cwd, label, timeout}` | Comando local; la salida se ve en vivo. |
| `/api/exec/script` | `{session, file, label, timeout, quiet}` | Ejecuta un `.py` **en Colab**. `quiet:true` oculta el base64. |
| `/api/exec/current` | — | Ejecución en curso (o la última). |
| `/api/exec/clear` | — | Limpia la vista. |

## Cuadernos

`/api/notebook/read`, `/api/notebook/save`, `/api/notebook/context`,
`/api/notebook/patch` (con `expectedHash`), `/api/notebook/cell`,
`/api/notebook/source-exec`, `/api/notebook/exec`, `/api/notebook/import`
(por URL), `/api/notebook/remote-read`, `/api/notebook/remote-save`,
`/api/notebook/remote-exec`.

## En directo

`/api/live` → cola de `prueba/live.log` (lo que escribe `live.sh` / `live.ps1`).

---

## Descarga automática (base64)

El panel vigila la salida de las ejecuciones en Colab. Si encuentra
`B64_META <ruta> bytes=<n> b64=<n> sha=<hash>`, luego líneas
`B64CHUNK <i> <base64>` y al final `B64_END`, **guarda el fichero solo** en
`COLAB_PANEL_DLDIR` y lo registra en el «Registro».

En el móvil no hay SSH ni la Contents API para `/content`: por eso el fichero
sale por stdout en base64 y el panel lo intercepta.

## Reglas de ouro (por qué la skill insiste en esto)

1. **Nunca uses `\r`** para las barras: el panel recorta esas líneas. Imprime
   una **línea nueva** cada 1-3 s con `PROGRESO xx.xx%`.
2. **Nunca lances un `colab exec` mientras haya una generación en marcha**: se
   encola detrás del kernel ocupado, agota el timeout y el CLI cancela tu
   ejecución. Para ver el estado usa el log del panel o `colab log` (no toca
   el kernel).
3. **Activa el keepalive** en cuanto crees el runtime: sin él, Colab lo libera
   por inactividad (~20 min) y se pierde el trabajo.
