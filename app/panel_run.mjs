#!/usr/bin/env node
/**
 * Ejecuta un comando A TRAVES del panel de Colab (Node, sin dependencias).
 * Toda la salida queda en vivo en la vista "Ejecucion" y en el "Registro"
 * del panel (http://127.0.0.1:8787) mientras se ejecuta.
 *
 *   node panel_run.mjs "comando shell" ["etiqueta"]
 *
 * Se usa desde panel_run.sh / panel_run.cmd: Node siempre esta disponible
 * porque es el runtime del propio panel (a diferencia de Python).
 */
import http from 'node:http';

const PANEL = process.env.COLAB_PANEL_URL || 'http://127.0.0.1:8787';
const CMD = process.argv[2] || '';
const LABEL = process.argv[3] || 'Agente';

if (!CMD) {
  console.error("uso: panel_run.mjs 'comando' [etiqueta]");
  process.exit(2);
}

const payload = JSON.stringify({ command: CMD, shell: true, label: LABEL, timeout: 7200000 });
const u = new URL('/api/exec/run', PANEL);
const req = http.request(
  {
    hostname: u.hostname,
    port: u.port || 80,
    path: u.pathname,
    method: 'POST',
    headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) },
  },
  (res) => {
    let body = '';
    res.on('data', (c) => { body += c; });
    res.on('end', () => {
      let r = {};
      try { r = JSON.parse(body); } catch {}
      const out = (r.stdout || '') + (r.stderr || '');
      process.stdout.write(out.slice(-4000));
      process.exit(r.ok ? 0 : 1);
    });
  }
);
req.on('error', (e) => {
  console.error('ERROR panel_run:', e.message);
  process.exit(3);
});
req.write(payload);
req.end();
