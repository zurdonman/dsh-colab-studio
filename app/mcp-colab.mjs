#!/usr/bin/env node
/** Minimal MCP stdio bridge for DSH -> the local Colab Studio panel. */
import readline from 'node:readline';
const BASE = process.env.COLAB_PANEL_URL || 'http://127.0.0.1:8787';
const tools = [
  {name:'colab_notebook_context',description:'Lee una celda de un notebook local y sus salidas.',inputSchema:{type:'object',properties:{file:{type:'string'},cell:{type:'integer'}},required:['file','cell']}},
  {name:'colab_notebook_patch',description:'Aplica un cambio a una celda con control de concurrencia. Requiere confirm=true.',inputSchema:{type:'object',properties:{file:{type:'string'},cell:{type:'integer'},source:{type:'string'},expectedHash:{type:'string'},confirm:{type:'boolean'}},required:['file','cell','source','expectedHash','confirm']}},
  {name:'colab_execute_cell',description:'Ejecuta una celda en el runtime Colab. Requiere confirm=true.',inputSchema:{type:'object',properties:{file:{type:'string'},session:{type:'string'},source:{type:'string'},confirm:{type:'boolean'}},required:['file','session','source','confirm']}},
  {name:'colab_runtime_status',description:'Consulta el estado del runtime Colab.',inputSchema:{type:'object',properties:{session:{type:'string'}},required:['session']}},
  {name:'colab_runtime_resources',description:'Consulta RAM, VRAM y almacenamiento del runtime.',inputSchema:{type:'object',properties:{session:{type:'string'}},required:['session']}}
];
async function callPanel(path, args) { const r = await fetch(`${BASE}${path}`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(args)}); return await r.json(); }
function result(value, isError=false) { return {content:[{type:'text',text:JSON.stringify(value,null,2)}],isError}; }
async function handle(msg) {
  if (msg.method === 'initialize') return {protocolVersion:'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'dsh-colab-studio',version:'0.1.0'}};
  if (msg.method === 'notifications/initialized') return null;
  if (msg.method === 'tools/list') return {tools};
  if (msg.method !== 'tools/call') return {};
  const {name,arguments: a={}} = msg.params || {};
  try {
    if (name === 'colab_notebook_context') return result(await callPanel('/api/notebook/context',a));
    if (name === 'colab_notebook_patch') { if (a.confirm !== true) return result({confirmation_required:true,message:'Confirma el parche antes de modificar la celda.'},true); return result(await callPanel('/api/notebook/patch',a)); }
    if (name === 'colab_execute_cell') { if (a.confirm !== true) return result({confirmation_required:true,message:'Confirma la ejecución antes de enviar código a Colab.'},true); return result(await callPanel('/api/notebook/cell',a)); }
    if (name === 'colab_runtime_status') return result(await callPanel('/api/runtime/status',a));
    if (name === 'colab_runtime_resources') return result(await callPanel('/api/runtime/resources',a));
    return result({error:`Herramienta desconocida: ${name}`},true);
  } catch (e) { return result({error:e.message},true); }
}
const rl = readline.createInterface({input:process.stdin,crlfDelay:Infinity});
rl.on('line', async (line) => { if (!line.trim()) return; let msg; try { msg=JSON.parse(line); } catch { return; } const value=await handle(msg); if (msg.id !== undefined && value !== null) process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:msg.id,result:value})+'\n'); });
