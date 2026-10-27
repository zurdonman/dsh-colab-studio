#!/usr/bin/env node
/**
 * Registra un hito en la bitacora "En directo" del panel (Node, sin dependencias).
 *
 *   node live.mjs "texto del hito"
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MSG = process.argv.slice(2).join(' ');

if (!MSG) {
  console.error("uso: live.mjs 'texto'");
  process.exit(2);
}

const LOG = join(HERE, 'prueba', 'live.log');
try {
  mkdirSync(dirname(LOG), { recursive: true });
  const stamp = new Date().toTimeString().slice(0, 8);
  appendFileSync(LOG, `[${stamp}] ${MSG}\n`);
} catch (e) {
  console.error('aviso live:', e.message);
  process.exit(1);
}
console.log(MSG);
