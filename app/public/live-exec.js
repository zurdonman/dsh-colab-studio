/* ============================================================
   Ejecución EN VIVO: streaming de toda salida al panel.
   - Cualquier ejecución (celda, script DSH, comando del agente)
     aparece en la vista "Ejecución" y en el "Registro" mientras corre.
   - Barra de progreso 0-100 % + latido (nunca parece colgado).
   Se carga DESPUÉS de app.js y sobrescribe refreshExecView/logOutput.
   ============================================================ */

state.execSeen = state.execSeen || {id: null, len: 0, text: '', pending: '', done: false, lastAt: 0};
state.execLast = null;

function execPushLog(text) {
  const t = String(text == null ? '' : text).replace(NOISE_RE, '').replace(/\n{3,}/g, '\n\n');
  if (!t.trim()) return;
  state.logs.push(t);
  const el = document.getElementById('logs');
  if (el) el.textContent = state.logs.slice(-400).join('\n');
  const lview = document.getElementById('view-logs');
  if (lview && lview.classList.contains('active')) el.scrollTop = el.scrollHeight;
}

function execDetectProgress(text) {
  const t = String(text || '');
  let pct = null, step = '';
  const pm = [...t.matchAll(/(\d{1,3}(?:[.,]\d+)?)\s*%/g)];
  if (pm.length) pct = Math.max(0, Math.min(100, parseFloat(pm[pm.length - 1][1].replace(',', '.'))));
  const sms = [...t.matchAll(/(?:step|paso)\s*(\d+)\s*(?:\/\s*(\d+)|de\s+(\d+))/gi)];
  const sm = sms.length ? sms[sms.length - 1] : null;
  if (sm) {
    const cur = Number(sm[1]), tot = Number(sm[2] || sm[3] || 0);
    step = 'paso ' + cur + (tot ? '/' + tot : '');
    if (pct === null && tot) pct = Math.round(100 * cur / tot);
  }
  if (pct === null) {
    const rm = t.match(/(\d+)\s*\/\s*(\d+)/);
    if (rm) { const c = Number(rm[1]), tt = Number(rm[2]); if (tt > 0 && c <= tt) pct = Math.round(100 * c / tt); }
  }
  return {pct, step};
}

function execSetBar(pct) {
  const wrap = document.getElementById('execProgress');
  const bar = document.getElementById('execBar');
  const lab = document.getElementById('execPct');
  if (!wrap || !bar || !lab) return;
  if (pct === null || pct === undefined) { wrap.hidden = true; return; }
  wrap.hidden = false;
  bar.style.width = Math.max(0, Math.min(100, pct)) + '%';
  lab.textContent = Math.round(pct) + ' %';
}

function execClock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60), h = Math.floor(m / 60);
  if (h) return h + ':' + String(m % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  return m + ':' + String(s % 60).padStart(2, '0');
}

function execRenderMeta(e) {
  const meta = document.getElementById('execMeta');
  const tm = document.getElementById('execTime');
  if (!meta) return;
  if (!e) {
    meta.textContent = 'Aún sin ejecuciones';
    execSetBar(null);
    if (tm) tm.hidden = true;
    return;
  }
  const st = e.status === 'running' ? '● En ejecución'
    : (e.status === 'done' ? '✓ Completado' + (e.exitCode == null ? '' : ' · rc=' + e.exitCode)
      : '✖ Error · rc=' + e.exitCode);
  const t0 = new Date(e.startedAt);
  const dur = e.endedAt ? Math.max(0, new Date(e.endedAt) - t0) : Math.max(0, Date.now() - t0);
  const seen = state.execSeen;
  const idle = (e.status === 'running' && seen.lastAt) ? Math.round((Date.now() - seen.lastAt) / 1000) : 0;
  const p = execDetectProgress(e.output || '');
  const bits = ['<b>' + escapeHtml(e.label || 'Ejecución') + '</b>', escapeHtml(st), '⏱ ' + execClock(dur)];
  if (e.status === 'running') bits.push(idle ? ('GPU trabajando · última línea hace ' + idle + ' s') : 'recibiendo datos');
  if (p.step) bits.push(escapeHtml(p.step));
  meta.innerHTML = bits.join(' <span class="muted">·</span> ');
  execSetBar(p.pct);
  if (tm) { tm.hidden = false; tm.textContent = (e.status === 'running' ? '● ' : '') + execClock(dur); }
}

function execRenderOut(e) {
  const out = document.getElementById('execOut');
  if (!out) return;
  const atBottom = out.scrollHeight - out.scrollTop - out.clientHeight < 40;
  out.textContent = e.output || '(sin salida todavía)';
  if (atBottom) out.scrollTop = out.scrollHeight;
}

function execRender(e) {
  const badge = document.getElementById('execBadge');
  if (badge) badge.hidden = !(e && e.status === 'running');
  execRenderMeta(e);
  execRenderOut(e);
}

async function refreshExecView() {
  let r;
  try {
    const x = await fetch('/api/exec/current', {method: 'POST', headers: {'content-type': 'application/json'}, body: '{}'});
    r = await x.json();
  } catch (e) { return; }
  let e = r && r.exec;
  if (e && state.execClearedAt && e.startedAt && new Date(e.startedAt).getTime() < state.execClearedAt) e = null;
  state.execLast = e;
  execRender(e);
}

function logOutput(label, out, isError) {
  const t = String(out || '').replace(NOISE_RE, '').replace(/\n{3,}/g, '\n\n').trim();
  const seen = state.execSeen;
  const streamed = !!(seen && seen.id && t && seen.text && seen.text.trim() === t);
  if (!t && !streamed) return;
  state.logs.push('[' + new Date().toLocaleTimeString() + '] ' + (isError ? '✖ ' : '✔ ') + label);
  if (streamed) { seen.text = ''; seen.pending = ''; }
  else state.logs.push(t);
  const el = document.getElementById('logs');
  if (el) el.textContent = state.logs.slice(-400).join('\n');
}

async function execPoll() {
  let r;
  try {
    const x = await fetch('/api/exec/current', {method: 'POST', headers: {'content-type': 'application/json'}, body: '{}'});
    r = await x.json();
  } catch (e) { return; }
  const e = r && r.exec;
  const seen = state.execSeen;
  if (!e) { if (seen.id) { seen.id = null; seen.len = 0; seen.text = ''; seen.pending = ''; } return; }
  if (state.execClearedAt && e.startedAt && new Date(e.startedAt).getTime() < state.execClearedAt) return;
  if (e.id !== seen.id) {
    seen.id = e.id; seen.len = 0; seen.text = ''; seen.pending = ''; seen.done = false; seen.lastAt = Date.now();
    execPushLog('[' + new Date().toLocaleTimeString() + '] ▶ ' + (e.label || 'Ejecución') + ' — iniciada');
  }
  const out = String(e.output || '');
  if (out.length < seen.len) { seen.len = 0; seen.text = ''; seen.pending = ''; }
  if (out.length > seen.len) {
    const chunk = out.slice(seen.len);
    seen.len = out.length;
    seen.text = (seen.text + chunk).slice(-200000);
    seen.lastAt = Date.now();
    seen.pending = (seen.pending || '') + chunk;
    const parts = seen.pending.split('\n');
    seen.pending = parts.pop();
    if (parts.length) execPushLog(parts.join('\n'));
  }
  if (!seen.done && e.status !== 'running') {
    seen.done = true;
    if (seen.pending) { execPushLog(seen.pending); seen.pending = ''; }
    execPushLog('[' + new Date().toLocaleTimeString() + '] ' + (e.status === 'done' ? '✔' : '✖') + ' ' + (e.label || 'Ejecución') + ' — ' + (e.status === 'done' ? 'terminada' : 'error') + (e.exitCode != null ? ' (rc=' + e.exitCode + ')' : ''));
  }
  state.execLast = e;
  execRender(e);
}

/* Reloj de segundos: aunque el script no emita líneas, el panel sigue "vivo" */
function execTick() {
  if (!state.execLast) return;
  execRenderMeta(state.execLast);
}

async function runLocalCommand() {
  const inp = document.getElementById('execCmd');
  const cmd = String((inp && inp.value) || '').trim();
  if (!cmd) return toast('Escribe un comando');
  openView('exec');
  const meta = document.getElementById('execMeta');
  if (meta) meta.textContent = 'Ejecutando: ' + cmd;
  try {
    const x = await fetch('/api/exec/run', {
      method: 'POST', headers: {'content-type': 'application/json'},
      body: JSON.stringify({command: cmd, shell: true, label: 'Local: ' + cmd.slice(0, 90), timeout: 3600000})
    });
    const r = await x.json();
    if (r && r.ok === false) execPushLog('[' + new Date().toLocaleTimeString() + '] ✖ ' + cmd + ' → ' + (r.error || 'sin salida'));
    else toast('Comando terminado');
  } catch (e) {
    execPushLog('[' + new Date().toLocaleTimeString() + '] ✖ ' + cmd + ' → ' + e.message);
  }
}

setInterval(execPoll, 1500);
setInterval(execTick, 1000);
execPoll();


// ===== Keepalive: que Colab no libere el runtime por inactividad =====
async function keepaliveStatus() {
  try {
    const x = await fetch('/api/runtime/keepalive/status', {method: 'POST', headers: {'content-type': 'application/json'}, body: '{}'});
    const r = await x.json();
    const el = document.getElementById('keepState');
    if (el) {
      if (r && r.enabled) {
        const ago = r.last ? Math.round((Date.now() - r.last) / 1000) : null;
        el.textContent = 'Keepalive ACTIVO · sesión ' + r.session + ' · ping cada 4 min' + (ago !== null ? ' · último hace ' + ago + ' s' : '');
      } else el.textContent = 'Keepalive: desactivado (Colab puede liberar el runtime si no se usa)';
    }
    return r;
  } catch (e) { return null; }
}

async function toggleKeepalive() {
  const sel = document.getElementById('activeSession');
  const ses = state.session || (sel && sel.value) || '';
  if (!ses) return toast('No hay runtime activo');
  const st = await keepaliveStatus();
  const r = await api('/api/runtime/keepalive', {session: ses, on: !(st && st.enabled)});
  await keepaliveStatus();
  toast(r && r.enabled ? 'Keepalive activado: el runtime no se liberará por inactividad' : 'Keepalive desactivado');
}

setInterval(keepaliveStatus, 20000);
keepaliveStatus();
