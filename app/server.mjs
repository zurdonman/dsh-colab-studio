import http from 'node:http';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { appendFileSync, existsSync, mkdirSync as mkdirpSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, extname, isAbsolute, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.COLAB_PANEL_PORT || 8787);
const HOST = process.env.COLAB_PANEL_HOST || '127.0.0.1';
const IS_WIN = process.platform === 'win32';
const HOME = process.env.HOME || process.env.USERPROFILE || ROOT;
const APPDATA = process.env.APPDATA || '';
const LOCALAPPDATA = process.env.LOCALAPPDATA || '';
// Carpetas donde suelen vivir los ejecutables: npm global (colab.cmd en Windows),
// pip --user y el store de Windows. Se anteponen al PATH del proceso.
const BIN_DIRS = [
  join(HOME, '.local', 'bin'),
  APPDATA ? join(APPDATA, 'npm') : '',
  LOCALAPPDATA ? join(LOCALAPPDATA, 'Microsoft', 'WindowsApps') : '',
].filter(Boolean);
const EXTRA_PATH = BIN_DIRS.filter((d) => { try { return existsSync(d); } catch { return false; } });
const ENV = { ...process.env, PATH: [...EXTRA_PATH, process.env.PATH ?? ''].filter(Boolean).join(delimiter) };
const COMSPEC = process.env.ComSpec || 'cmd.exe';
const GPU = new Set(['CPU', 'T4', 'L4', 'A100', 'H100']);
const authRuns = new Map();
const send = (res, status, value, type = 'application/json; charset=utf-8') => { res.writeHead(status, {'content-type': type, 'cache-control': 'no-store'}); res.end(type.startsWith('application/json') ? JSON.stringify(value) : value); };
const fail = (res, message, status = 400) => send(res, status, {ok: false, error: message});
const CLI_NOISE = /A new version of Colab CLI is available|Run 'colab update' to update|To silence this check|enable_update_check/;
const stripNoise = (t) => String(t == null ? '' : t).split('\n').filter((l) => !CLI_NOISE.test(l)).join('\n');
// --- ejecutables: en Windows los .cmd/.bat de npm (colab.cmd) no se pueden lanzar
// con shell:false desde Node, hay que pasar por cmd.exe con los argumentos bien citados.
const quoteWin = (a) => '"' + String(a).replace(/"/g, '""') + '"';
function winSpawn(file, args, opts = {}) {
  const {shell, ...rest} = opts; // el shell lo pone cmd.exe; no hay que anidarlo
  const line = [quoteWin(file), ...args.map(quoteWin)].join(' ');
  return spawn(COMSPEC, ['/d', '/s', '/c', `"${line}"`], {...rest, windowsVerbatimArguments: false});
}
function resolveColab() {
  if (process.env.COLAB_BIN) return process.env.COLAB_BIN;
  const names = IS_WIN ? ['colab.cmd', 'colab.exe', 'colab.bat', 'colab'] : ['colab'];
  for (const dir of String(ENV.PATH || '').split(delimiter)) {
    if (!dir) continue;
    for (const n of names) {
      const p = join(dir, n);
      try { if (existsSync(p)) return p; } catch {}
    }
  }
  return 'colab';
}
const COLAB_BIN = resolveColab();
function spawnSmart(file, args, opts = {}) {
  if (IS_WIN && /\.(cmd|bat)$/i.test(file)) return winSpawn(file, args, opts);
  return spawn(file, args, opts);
}
function runProcess(argv, {timeout = 600000, onData = null, shell = false, cwd = undefined, env = ENV} = {}) {
  return new Promise((done) => {
    const p = spawnSmart(argv[0], argv.slice(1), {stdio: ['pipe', 'pipe', 'pipe'], shell: !!shell, cwd, env});
    let out = '', err = '', ended = false;
    const finish = (v) => { if (!ended) { ended = true; clearTimeout(timer); done(v); } };
    const timer = setTimeout(() => { try { p.kill('SIGTERM'); } catch {} finish({ok: false, code: null, stdout: stripNoise(out), stderr: stripNoise(err) + '\nTiempo agotado'}); }, timeout);
    const outFeed = lineFilter((s) => { out += s; if (onData) try { onData(s); } catch {} });
    const errFeed = lineFilter((s) => { err += s; if (onData) try { onData(s); } catch {} });
    p.stdout.on('data', outFeed); p.stderr.on('data', errFeed);
    p.on('error', (e) => finish({ok: false, code: null, stdout: stripNoise(out), stderr: stripNoise(e.message)}));
    p.on('close', (code) => finish({ok: code === 0, code, stdout: stripNoise(out), stderr: stripNoise(err)}));
    p.stdin.end();
  });
}
function lineFilter(emit) { let buf = ''; return (chunk) => { buf += String(chunk); const parts = buf.split('\n'); buf = parts.pop(); const clean = parts.map((l) => (l.includes('\r') ? l.slice(l.lastIndexOf('\r') + 1) : l)).filter((l) => !CLI_NOISE.test(l)); if (clean.length) emit(clean.join('\n') + '\n'); }; }
function runColab(args, {input = '', timeout = 120000, onData = null} = {}) { return new Promise((done) => { const p = spawnSmart(COLAB_BIN, args, {stdio: ['pipe', 'pipe', 'pipe'], env: ENV}); let out = '', err = '', ended = false; const finish = (v) => { if (!ended) { ended = true; clearTimeout(timer); done(v); } }; const timer = setTimeout(() => { p.kill('SIGTERM'); finish({ok: false, code: null, stdout: stripNoise(out), stderr: stripNoise(err) + '\nTiempo agotado'}); }, timeout); const outFeed = lineFilter((s) => { out += s; if (onData) try { onData(s); } catch {} }); const errFeed = lineFilter((s) => { err += s; if (onData) try { onData(s); } catch {} }); p.stdout.on('data', outFeed); p.stderr.on('data', errFeed); p.on('error', (e) => finish({ok: false, code: null, stdout: stripNoise(out), stderr: stripNoise(e.message), hint: e.code === 'ENOENT' ? 'Instala google-colab-cli (npm i -g google-colab-cli) o define COLAB_BIN con la ruta al ejecutable.' : undefined})); p.on('close', (code) => finish({ok: code === 0, code, stdout: stripNoise(out), stderr: stripNoise(err)})); if (input) p.stdin.write(input); p.stdin.end(); }); }
function session(v) { if (typeof v !== 'string' || !/^[A-Za-z0-9._-]{1,64}$/.test(v)) throw Error('Nombre de sesión inválido'); return v; }
function notebookPath(v) { if (typeof v !== 'string' || v.includes('\0') || !v.toLowerCase().endsWith('.ipynb')) throw Error('Ruta .ipynb inválida'); return resolve(v); }
function scriptPath(v) { if (typeof v !== 'string' || v.includes('\0') || !/\.(py|txt|md|sh|json|yaml|yml)$/i.test(v)) throw Error('Ruta de script inválida'); return resolve(v); }
async function body(req) { let s = ''; for await (const c of req) { s += c; if (s.length > 35e6) throw Error('Petición demasiado grande'); } return s ? JSON.parse(s) : {}; }
async function readNotebook(file) { const info = await stat(file); if (info.size > 25e6) throw Error('Notebook mayor de 25 MB'); return JSON.parse(await readFile(file, 'utf8')); }
function sourceHash(source) { return createHash('sha256').update(String(source || '')).digest('hex'); }
function startAuth() { const id = randomUUID(); const child = spawnSmart(COLAB_BIN, ['sessions'], {stdio: ['pipe', 'pipe', 'pipe'], env: ENV}); const r = {id, child, stdout: '', stderr: '', done: false, code: null}; authRuns.set(id, r); child.stdout.on('data', (x) => r.stdout += x); child.stderr.on('data', (x) => r.stderr += x); child.on('error', (e) => { r.stderr += e.message; r.done = true; }); child.on('close', (c) => { r.code = c; r.done = true; }); setTimeout(() => authRuns.delete(id), 600000); return r; }
const authView = (r) => ({ok: r.done && r.code === 0, done: r.done, requestId: r.id, code: r.code, stdout: r.stdout, stderr: r.stderr});
async function waitAuth(r) { const start = Date.now(); while (!r.done && Date.now() - start < 180000) await new Promise((x) => setTimeout(x, 100)); if (!r.done) { r.child.kill('SIGTERM'); r.done = true; r.stderr += '\nTiempo agotado.'; } return authView(r); }
// --- registro de ejecuciones: la vista «Ejecución» es persistente y solo muestra la celda en curso ---
const EXEC_FILE = join(ROOT, 'prueba', 'last_exec.json');
let execRec = null;
try { execRec = JSON.parse(readFileSync(EXEC_FILE, 'utf8')); } catch {}
let execSaveT = null;
function execSaveRec(rec) { if (execRec !== rec) return; clearTimeout(execSaveT); execSaveT = setTimeout(() => { try { writeFileSync(EXEC_FILE, JSON.stringify(execRec)); } catch {} }, 300); }
function execStart(d, label) { execRec = {id: randomUUID().slice(0, 8), label: String((d && d.label) || label || 'Ejecución').slice(0, 140), session: String((d && d.session) || ''), source: String((d && d.source) || '').slice(0, 12000), status: 'running', startedAt: new Date().toISOString(), endedAt: null, exitCode: null, output: '', quiet: Boolean(d && d.quiet)}; execSaveRec(execRec); return execRec; }
async function execRun(d, label, make) { const rec = execStart(d, label); let r; try { r = await make((t) => { rec.output = (rec.output + String(t)).slice(-200000); execSaveRec(rec); }); } catch (e) { rec.output = (rec.output + `\n[panel] Error: ${e.message}\n`).slice(-200000); if (rec.status === 'running') { rec.status = 'error'; rec.exitCode = -1; rec.endedAt = new Date().toISOString(); } execSaveRec(rec); return {ok: false, error: e.message, stdout: '', stderr: e.message}; } if (!rec.output && !rec.quiet && (r.stdout || r.stderr)) rec.output = (String(r.stdout || '') + String(r.stderr || '')).slice(-200000); if (rec.status === 'running') { rec.status = r.ok ? 'done' : 'error'; rec.exitCode = r.code == null ? null : r.code; rec.endedAt = new Date().toISOString(); } execSaveRec(rec); return r; }
async function localFiles(dir) { const es = await readdir(dir, {withFileTypes: true}); return {ok: true, path: dir, items: es.map((e) => ({name: e.name, type: e.isDirectory() ? 'directory' : 'file', notebook: e.isFile() && e.name.endsWith('.ipynb'), script: e.isFile() && /\.(py|txt|md|sh)$/i.test(e.name)})).sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name))}; }
// --- auto-descarga: si la salida trae un bloque base64 (B64CHUNK/B64_END), se guarda en el telefono ---
const DEFAULT_DL_DIR = IS_WIN ? join(HOME, 'Downloads', 'pruebas generated') : '/storage/emulated/0/Download/pruebas generated';
const DL_DIR = process.env.COLAB_PANEL_DLDIR || DEFAULT_DL_DIR;
// Carpeta de trabajo donde el agente guarda los .py/.ipynb que se ven en «Celdas DSH».
const DEFAULT_WORK_DIR = IS_WIN ? join(HOME, 'Documents', 'DSH Colab Studio') : '/storage/emulated/0/Download/rensi colabdsh';
const WORK_DIR = process.env.COLAB_PANEL_WORKDIR || DEFAULT_WORK_DIR;
for (const d of [join(ROOT, 'prueba'), DL_DIR, WORK_DIR]) { try { mkdirpSync(d, {recursive: true}); } catch {} }
const dlState = {buf: [], meta: null, active: false};
function dlFeed(text) {
  const s = String(text == null ? '' : text);
  const lines = s.split('\n');
  for (const raw of lines) {
    const l = raw.trim();
    if (l.startsWith('B64_META ')) { dlState.meta = l.slice(9).trim(); dlState.active = true; continue; }
    if (l.startsWith('B64CHUNK ')) { const p = l.indexOf(' ', 9); if (p > 0) dlState.buf.push(l.slice(p + 1).trim()); dlState.active = true; continue; }
    if (l === 'B64_END') { dlFinalize(); continue; }
  }
}
function dlFinalize() {
  if (!dlState.buf.length) return;
  const meta = dlState.meta || '';
  const b64 = dlState.buf.join('');
  dlState.buf = [];
  try {
    const data = Buffer.from(b64, 'base64');
    const m = meta.match(/bytes=(\d+)/);
    const exp = m ? Number(m[1]) : null;
    const nameM = meta.match(/^(\S+)/);
    let name = nameM ? nameM[1].split('/').pop() : 'video_descargado.mp4';
    if (!/\.mp4$/i.test(name)) name = name.replace(/\.[^.]*$/, '') + '.mp4';
    try { mkdirpSync(DL_DIR, {recursive: true}); } catch {}
    const dest = join(DL_DIR, name);
    writeFileSync(dest, data);
    const ok = exp ? (data.length === exp) : true;
    const msg = `[panel] DESCARGA AUTOMATICA ${ok ? 'OK' : 'TAMANO INESPERADO'}: ${dest} (${(data.length/1e6).toFixed(1)} MB)`;
    console.log(msg);
    try { appendFileSync(join(ROOT, 'prueba', 'live.log'), `[${new Date().toISOString().slice(11,19)}] ${msg}\n`); } catch {}
    dlState.meta = null; dlState.active = false;
  } catch (e) { console.log('[panel] error en auto-descarga:', e.message); }
}
// --- keepalive: evita que Colab libere el runtime por inactividad ---
const keepalive = {session: '', timer: null, last: 0, ok: null, pings: 0, errors: 0, enabled: false};
async function keepalivePing() {
  if (!keepalive.session) return;
  const ses = keepalive.session;
  // Si hay una EJECUCION en curso NO se lanza un 'colab exec' encima: se queda
  // encolado detras del kernel ocupado, agota su timeout y el CLI cancela la
  // ejecucion (asi se perdio la sesion ltx-ad). Durante una generacion se usa un
  // ping barato por la API de Drive (upload), que no toca el kernel.
  const busy = !!(execRec && execRec.status === 'running');
  if (busy) {
    try {
      const dir = await mkdtemp(join(tmpdir(), 'dsh-ka-'));
      const f = join(dir, 'ka.txt');
      await writeFile(f, 'keepalive ' + Date.now() + '\n');
      const r = await runColab(['upload', f, '/dsh_keepalive.txt', '-s', ses], {timeout: 60000});
      keepalive.last = Date.now(); keepalive.pings++; keepalive.ok = r.ok;
      if (!r.ok) keepalive.errors++;
      setTimeout(() => rm(dir, {recursive: true, force: true}), 30000).unref();
    } catch (e) { keepalive.ok = false; keepalive.errors++; }
    return;
  }
  const dir = await mkdtemp(join(tmpdir(), 'dsh-ka-'));
  const f = join(dir, 'ka.py');
  try {
    await writeFile(f, "import time\nprint('KEEPALIVE', time.strftime('%H:%M:%S'), flush=True)\ntry:\n import torch\n torch.zeros(8, device='cuda').sum().item()\n print('KA_GPU_OK', flush=True)\nexcept Exception as e:\n print('KA_GPU_SKIP', flush=True)\n");
    const r = await runColab(['exec', '--timeout', '120', '-s', ses, '-f', f], {timeout: 150000});
    keepalive.last = Date.now(); keepalive.pings++; keepalive.ok = r.ok;
    if (!r.ok) keepalive.errors++;
  } catch (e) { keepalive.ok = false; keepalive.errors++; }
  finally { setTimeout(() => rm(dir, {recursive: true, force: true}), 30000).unref(); }
}
function setKeepalive(ses, on) {
  if (keepalive.timer) { clearInterval(keepalive.timer); keepalive.timer = null; }
  keepalive.enabled = !!on;
  keepalive.session = on ? ses : '';
  if (on) { keepalivePing(); keepalive.timer = setInterval(keepalivePing, 4 * 60 * 1000); if (keepalive.timer.unref) keepalive.timer.unref(); }
  return {ok: true, session: keepalive.session, enabled: keepalive.enabled, last: keepalive.last, pings: keepalive.pings, errors: keepalive.errors, okPing: keepalive.ok};
}
// El CLI de Colab guarda el token en ~/.config/colab-cli/token.json (Termux/Linux).
// En Windows puede vivir en %APPDATA% o %LOCALAPPDATA%: se buscan todas las ubicaciones.
function cliTokenDir() {
  const candidates = [
    process.env.COLAB_CLI_DIR,
    join(HOME, '.config', 'colab-cli'),
    APPDATA ? join(APPDATA, 'colab-cli') : '',
    LOCALAPPDATA ? join(LOCALAPPDATA, 'colab-cli') : '',
  ].filter(Boolean);
  for (const d of candidates) { try { if (existsSync(d)) return d; } catch {} }
  return candidates[0];
}
async function api(path, d) {
  if (path === '/api/health') return runColab(['version'], {timeout: 10000});
  if (path === '/api/config') return {ok: true, home: HOME, workDir: WORK_DIR, dlDir: DL_DIR, root: ROOT, platform: process.platform, isWin: IS_WIN, port: PORT, host: HOST, cli: COLAB_BIN, node: process.version};
  if (path === '/api/auth/status') { const r = await runColab(['sessions'], {timeout: 10000}); return {authorized: r.ok, cli: r.code !== null, output: r.ok ? r.stdout : r.stderr}; }
  if (path === '/api/auth/start') { const r = startAuth(); const t0 = Date.now(); while (!r.done && Date.now() - t0 < 8000) { if (/https:\/\/accounts\.google\.com\//.test(r.stderr + r.stdout)) break; await new Promise((x) => setTimeout(x, 150)); } return authView(r); }
  if (path === '/api/auth/submit') { const r = authRuns.get(String(d.requestId)); if (!r || r.done) throw Error('OAuth inexistente o terminado'); if (typeof d.code !== 'string' || d.code.length < 4 || d.code.length > 4096) throw Error('Código OAuth inválido'); r.child.stdin.write(`${d.code.trim()}\n`); r.child.stdin.end(); return waitAuth(r); }
  if (path === '/api/auth/logout') { const tok = join(cliTokenDir(), 'token.json'); try { await stat(tok); } catch { return {ok: true, already: true, message: 'No había token que cerrar'}; } const bak = `${tok}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`; await rename(tok, bak); return {ok: true, backup: bak.slice(bak.lastIndexOf('/') + 1), message: 'Cuenta cerrada. La próxima autenticación entrará con la cuenta que elijas.'}; }
  if (path === '/api/auth/restore') { const dir = cliTokenDir(); let names = []; try { names = await readdir(dir); } catch {} const baks = names.filter((x) => x.startsWith('token.json.bak-')).sort(); if (!baks.length) return {ok: false, error: 'No hay ninguna copia de la cuenta anterior'}; const newest = baks[baks.length - 1]; await rename(join(dir, newest), join(dir, 'token.json')); return {ok: true, restored: newest, message: 'Cuenta anterior restaurada.'}; }
  if (path === '/api/sessions') return runColab(['sessions']);
  if (path === '/api/runtime/new') { const s = session(d.session || 'dsh-colab'), gpu = String(d.gpu || 'T4').toUpperCase(); if (!GPU.has(gpu)) throw Error('GPU no permitida'); const a = ['new', '-s', s]; if (gpu !== 'CPU') a.push('--gpu', gpu); if (d.highMem) a.push('--high-mem'); const result = await runColab(a, {timeout: 300000}); if (result.ok) setKeepalive(s, true); const highMemUnavailable = Boolean(d.highMem) && /shape=hm.*Service Unavailable|Service Unavailable.*shape=hm/i.test(result.stderr); return {...result, requestedSession: s, requestedGpu: gpu, highMemRequested: Boolean(d.highMem), errorCode: highMemUnavailable ? 'high_mem_unavailable' : undefined, userMessage: highMemUnavailable ? 'Colab no pudo asignar memoria alta para esta GPU o cuenta. Prueba sin memoria alta o usa Colab Pro/Pro+.' : undefined}; }
  if (path === '/api/runtime/status') return runColab(['status', '-s', session(d.session)]);
  if (path === '/api/runtime/keepalive') { const on = d.on !== false; const s = session(d.session || keepalive.session || 'dsh-colab'); return setKeepalive(s, on); }
  if (path === '/api/runtime/keepalive/status') return {ok: true, session: keepalive.session, enabled: keepalive.enabled, last: keepalive.last, pings: keepalive.pings, errors: keepalive.errors, okPing: keepalive.ok};
  if (path === '/api/runtime/resources') { if (execRec && execRec.status === 'running') return {ok:true, busy:true, resources:null, resourcesError:'sesion ocupada: no se ejecuta nada para no interferir con la generacion'}; const dir = await mkdtemp(join(tmpdir(), 'dsh-resources-')), file = join(dir, 'resources.py'); const code = `import json, shutil, os\nr={"ram_used":None,"ram_total":None,"storage_used":None,"storage_total":None,"vram_used":None,"vram_total":None}\ntry:\n import psutil\n m=psutil.virtual_memory(); r["ram_used"]=m.used; r["ram_total"]=m.total\nexcept Exception: pass\ntry:\n d=shutil.disk_usage('/content'); r["storage_used"]=d.used; r["storage_total"]=d.total\nexcept Exception: pass\ntry:\n import torch\n if torch.cuda.is_available():\n  r["vram_used"]=torch.cuda.memory_allocated(); r["vram_total"]=torch.cuda.get_device_properties(0).total_memory\nexcept Exception: pass\nprint(json.dumps(r))\n`; await writeFile(file, code); try { let result = {ok: false, code: null, stdout: '', stderr: ''}, line = null; for (let i = 0; i < 2 && !line; i++) { result = await runColab(['exec', '--timeout', '3600', '-s', session(d.session), '-f', file], {timeout: 20000}); line = String(result.stdout || '').trim().split('\n').reverse().find((x) => x.trim().startsWith('{')); if (!line && i < 1) await new Promise((x) => setTimeout(x, 2000)); } let resources = null; if (line) { try { resources = JSON.parse(line); } catch {} } return {...result, resources, resourcesError: resources ? undefined : 'Sin datos de recursos (rc=' + result.code + ')'}; } finally { await rm(dir, {recursive: true, force: true}); } }
  if (path === '/api/runtime/stop') return runColab(['stop', '-s', session(d.session)]);
  if (path === '/api/runtime/stop-all') {
    const parse = (t) => String(t || '').split('\n').filter((l) => /^\[[A-Za-z0-9._-]{1,64}\]/.test(l) && l.includes('|')).map((l) => l.match(/^\[([A-Za-z0-9._-]{1,64})\]/)[1]);
    const before = await runColab(['sessions'], {timeout: 20000});
    if (!before.ok) return {ok: false, authorized: false, found: [], still: [], error: (before.stderr || before.stdout || 'Colab no responde').trim().slice(-300)};
    const found = parse(before.stdout);
    const results = [];
    for (const n of found) { const r = await runColab(['stop', '-s', session(n)], {timeout: 120000}); results.push({name: n, rc: r.code, out: String(r.stdout || r.stderr || '').trim().slice(-160)}); }
    let after = await runColab(['sessions'], {timeout: 20000});
    if (parse(after.stdout).length) { // por si el CLI devuelve rc raro y no paró todo
      for (const n of parse(after.stdout)) { await runColab(['stop', '-s', session(n)], {timeout: 120000}); await new Promise((x) => setTimeout(x, 3000)); }
      after = await runColab(['sessions'], {timeout: 20000});
    }
    const still = parse(after.stdout);
    const usage = await runColab(['usage'], {timeout: 15000});
    const ut = (usage.stdout || '') + (usage.stderr || '');
    const b = ut.match(/Current balance:\s*([\d.]+)\s*compute units/); const u = ut.match(/Usage rate:\s*([\d.]+)\/hr/); const a = ut.match(/Active assignments:\s*(\d+)/);
    return {ok: still.length === 0, found, results, still, verify: String(after.stdout || '').trim(), balance: b ? Number(b[1]) : null, rate: u ? Number(u[1]) : null, assignments: a ? Number(a[1]) : null, usageRaw: ut.trim()};
  }
  if (path === '/api/runtime/url') return runColab(['url', '-s', session(d.session)]);
  if (path === '/api/runtime/drive') return runColab(['drivemount', '-s', session(d.session)], {timeout: 600000});
  if (path === '/api/files/local') return localFiles(resolve(typeof d.path === 'string' && d.path ? d.path : HOME));
  if (path === '/api/file/raw') { const f = scriptPath(d.file); const info = await stat(f); if (info.size > 1e6) throw Error('Archivo mayor de 1 MB'); return {ok: true, file: f, source: await readFile(f, 'utf8')}; }
  if (path === '/api/file/save') { if (typeof d.source !== 'string') throw Error('source inválido'); const f = scriptPath(d.file); await writeFile(f, d.source, 'utf8'); return {ok: true, file: f, bytes: Buffer.byteLength(d.source)}; }
  if (path === '/api/files/remote') return runColab(['ls', '-s', session(d.session), d.path || '/content']);
  if (path === '/api/usage') { const r = await runColab(['usage'], {timeout: 15000}); const t = (r.stdout || '') + (r.stderr || ''); const b = t.match(/Current balance:\s*([\d.]+)\s*compute units/); const u = t.match(/Usage rate:\s*([\d.]+)\/hr/); const a = t.match(/Active assignments:\s*(\d+)/); return {ok: r.ok, balance: b ? Number(b[1]) : null, rate: u ? Number(u[1]) : null, assignments: a ? Number(a[1]) : null, raw: t.trim()}; }
  if (path === '/api/live') { try { const t = await readFile(join(ROOT, 'prueba', 'live.log'), 'utf8'); return {ok: true, tail: t.slice(-60000)}; } catch { return {ok: true, tail: '(aún sin eventos)'}; } }
  if (path === '/api/exec/current') return {ok: true, exec: execRec};
  if (path === '/api/exec/run') { const argv = Array.isArray(d.argv) ? d.argv.map((x) => String(x)) : (typeof d.command === 'string' && d.command.trim() ? [d.command] : []); if (!argv.length) throw Error('Falta el comando'); const timeout = Math.min(Math.max(Number(d.timeout) || 900000, 1000), 7200000); const shell = !!d.shell || (argv.length === 1 && /[|;&><]/.test(argv[0])); const cwd = typeof d.cwd === 'string' && d.cwd ? d.cwd : undefined; const label = String(d.label || ('Cmd ' + argv.join(' '))).slice(0, 140); return await execRun({...d, source: argv.join(' ')}, label, (onData) => runProcess(argv, {timeout, onData, shell, cwd})); }
  if (path === '/api/exec/script') { const f = String(d.file || ''); if (!f) throw Error('Falta el fichero'); if (!isAbsolute(f)) throw Error('Ruta local inválida'); const ses = session(d.session); const timeout = Math.min(Math.max(Number(d.timeout) || 3600000, 1000), 7200000); const label = String(d.label || ('Script ' + f.split('/').pop())).slice(0, 140); return await execRun({...d, source: f, quiet: !!d.quiet}, label, (onData) => runColab(['exec', '--timeout', String(Math.ceil(timeout/1000)), '-s', ses, '-f', f], {timeout, onData: (t) => { dlFeed(t); const vis = String(t).split('\n').filter((l) => !/^\s*(B64CHUNK|B64_META|B64_END)\b/.test(l)).join('\n'); if (vis.trim()) onData(vis); }})); }
  if (path === '/api/exec/clear') { execRec = null; try { await rm(join(ROOT, 'prueba', 'last_exec.json'), {force: true}); } catch {} try { await writeFile(join(ROOT, 'prueba', 'last_exec.json'), JSON.stringify(null)); } catch {} return {ok: true}; }
  if (path === '/api/notebook/read') return {ok: true, file: d.file, notebook: await readNotebook(notebookPath(d.file))};
  if (path === '/api/notebook/remote-read') { const dir = await mkdtemp(join(tmpdir(), 'dsh-remote-notebook-')), local = join(dir, 'remote.ipynb'); try { const r = await runColab(['download', '-s', session(d.session), d.remote, local], {timeout: 180000}); if (!r.ok) return r; return {ok: true, remote: d.remote, notebook: await readNotebook(local)}; } finally { await rm(dir, {recursive: true, force: true}); } }
  if (path === '/api/notebook/remote-save') { const dir = await mkdtemp(join(tmpdir(), 'dsh-remote-save-')), local = join(dir, 'remote.ipynb'); try { if (!d.notebook || !Array.isArray(d.notebook.cells)) throw Error('Notebook inválido'); await writeFile(local, JSON.stringify(d.notebook, null, 1) + '\n'); return runColab(['upload', '-s', session(d.session), local, d.remote], {timeout: 180000}); } finally { await rm(dir, {recursive: true, force: true}); } }
  if (path === '/api/notebook/source-exec') { const dir = await mkdtemp(join(tmpdir(), 'dsh-source-exec-')), local = join(dir, 'cell.py'); try { if (typeof d.source !== 'string' || d.source.length > 2e6) throw Error('Código inválido'); await writeFile(local, d.source); return await execRun(d, d.label || (d.file ? String(d.file).split('/').pop() : 'Script'), (onData) => runColab(['exec', '--timeout', '3600', '-s', session(d.session), '-f', local], {timeout: 600000, onData})); } finally { setTimeout(() => rm(dir, {recursive: true, force: true}), 120000).unref(); } }
  if (path === '/api/notebook/remote-exec') { const dir = await mkdtemp(join(tmpdir(), 'dsh-remote-cell-')), local = join(dir, 'cell.py'); try { if (typeof d.source !== 'string' || d.source.length > 2e6) throw Error('Código inválido'); await writeFile(local, d.source); return await execRun(d, d.label || 'Celda remota', (onData) => runColab(['exec', '--timeout', '3600', '-s', session(d.session), '-f', local], {timeout: 600000, onData})); } finally { setTimeout(() => rm(dir, {recursive: true, force: true}), 120000).unref(); } }
  if (path === '/api/notebook/context') { const n = await readNotebook(notebookPath(d.file)); const i = Number.isInteger(d.cell) ? d.cell : 0; if (!n.cells?.[i]) throw Error('Celda no encontrada'); const c = n.cells[i]; const source = Array.isArray(c.source) ? c.source.join('') : String(c.source || ''); return {ok: true, file: d.file, cell: i, cell_type: c.cell_type || 'code', source, outputs: c.outputs || [], sourceHash: sourceHash(source)}; }
  if (path === '/api/notebook/patch') { const f = notebookPath(d.file); const n = await readNotebook(f); const i = Number.isInteger(d.cell) ? d.cell : 0; if (!n.cells?.[i]) throw Error('Celda no encontrada'); const old = Array.isArray(n.cells[i].source) ? n.cells[i].source.join('') : String(n.cells[i].source || ''); if (d.expectedHash && d.expectedHash !== sourceHash(old)) throw Error('El notebook cambió; vuelve a leer la celda antes de aplicar el parche'); if (typeof d.source !== 'string' || d.source.length > 2e6) throw Error('Código de celda inválido'); n.cells[i].source = d.source; await writeFile(f, JSON.stringify(n, null, 1) + '\n'); return {ok: true, file: f, cell: i, sourceHash: sourceHash(d.source)}; }
  if (path === '/api/notebook/save') { const f = notebookPath(d.file); if (!d.notebook || !Array.isArray(d.notebook.cells)) throw Error('Notebook inválido'); await writeFile(f, JSON.stringify(d.notebook, null, 1) + '\n'); return {ok: true, file: f}; }
  if (path === '/api/notebook/import') { const u = String(d.url || ''); if (!/^https?:\/\//i.test(u)) throw Error('URL http(s) inválida'); const f = notebookPath(d.file); const candidates = [u]; const match = u.match(/^https:\/\/colab\.research\.google\.com\/drive\/([^/?#]+)/i); if (match) candidates.unshift(`https://colab.research.google.com/drive/${match[1]}/export?format=ipynb`); let text = ''; let last = ''; for (const candidate of candidates) { const x = await fetch(candidate); if (!x.ok) { last = `HTTP ${x.status}`; continue; } text = await x.text(); if (!text.trim().startsWith('<')) break; last = 'La URL devuelve HTML'; } if (!text || text.trim().startsWith('<')) throw Error(`${last || 'No se pudo descargar'}; usa una URL raw o exporta el notebook`); const n = JSON.parse(text); if (!Array.isArray(n.cells)) throw Error('El recurso no es un notebook'); await writeFile(f, JSON.stringify(n, null, 1) + '\n'); return {ok: true, file: f, notebook: n}; }
  if (path === '/api/notebook/exec') return execRun(d, d.label || (d.file ? String(d.file).split('/').pop() : 'Notebook'), (onData) => runColab(['exec', '--timeout', '3600', '-s', session(d.session), '-f', notebookPath(d.file)], {timeout: 600000, onData}));
  if (path === '/api/notebook/cell') { const dir = await mkdtemp(join(tmpdir(), 'dsh-cell-')), f = join(dir, 'cell.py'); await writeFile(f, String(d.source || '')); try { return await execRun(d, d.label || 'Celda', (onData) => runColab(['exec', '--timeout', '3600', '-s', session(d.session), '-f', f], {timeout: 600000, onData})); } finally { setTimeout(() => rm(dir, {recursive: true, force: true}), 120000).unref(); } }
  if (path === '/api/install') { const p = Array.isArray(d.packages) ? d.packages.filter((x) => /^[A-Za-z0-9_.-]+(==[A-Za-z0-9.*+!-]+)?$/.test(x)).slice(0, 50) : []; if (!p.length) throw Error('Indica paquetes válidos'); return runColab(['install', '-s', session(d.session), ...p], {timeout: 600000}); }
  throw Error('Ruta API no encontrada');
}
const MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8'};
async function serve(req, res) { const u = new URL(req.url, `http://${req.headers.host}`); if (u.pathname.startsWith('/api/')) { if (req.method !== 'POST' && u.pathname !== '/api/health') return fail(res, 'Método no permitido', 405); try { return send(res, 200, await api(u.pathname, req.method === 'POST' ? await body(req) : {})); } catch (e) { return fail(res, e.message); } } const file = u.pathname === '/' ? join(ROOT, 'public/index.html') : normalize(join(ROOT, 'public', u.pathname.slice(1))); if (!file.startsWith(join(ROOT, 'public'))) return fail(res, 'Ruta no permitida', 403); try { return send(res, 200, await readFile(file), MIME[extname(file)] || 'application/octet-stream'); } catch { return fail(res, 'No encontrado', 404); } }
http.createServer(serve).listen(PORT, HOST, () => console.log(`DSH Colab Studio: http://${HOST}:${PORT}`));
