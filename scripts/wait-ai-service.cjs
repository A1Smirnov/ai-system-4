'use strict';
const fs = require('node:fs');
const path = require('node:path');
const mode = process.argv[2];
if (!['gateway', 'dashboard', 'preflight'].includes(mode)) throw Error('Expected gateway, dashboard, or preflight');
const endpoint = mode === 'gateway' ? 'http://127.0.0.1:18789/readyz' : 'http://127.0.0.1:18795/health';
const deadline = Date.now() + (mode === 'gateway' ? 420000 : 30000);
(async () => {
  // This service group deliberately starts no autonomous workers.
  const errors = require('./diagnose-ai-system.cjs').configurationErrors(path.resolve(__dirname, '..'));
  if (errors.length) throw Error(errors.join('; '));
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '../state/openclaw.json')));
  if (cfg.cron?.enabled !== false) throw Error('AI-System manual mode requires cron.enabled=false');
  for (const agent of Object.values(cfg.agents.entries)) {
    const heartbeat = agent.heartbeat ?? cfg.agents.defaults.heartbeat;
    if (heartbeat?.every !== '0m') throw Error('AI-System manual mode requires disabled agent heartbeats');
  }
  if (mode === 'preflight') {
    const net = require('node:net');
    const occupied = await new Promise(resolve => {
      const socket = net.connect({ host: '127.0.0.1', port: 18789 });
      socket.setTimeout(2000);
      socket.once('connect', () => { socket.destroy(); resolve(true); });
      socket.once('error', () => { socket.destroy(); resolve(false); });
      socket.once('timeout', () => { socket.destroy(); resolve(true); });
    });
    if (occupied) throw Error('Gateway port is already occupied; refusing a duplicate start');
    console.log('Manual-mode preflight passed');
    return;
  }
  let last = 'Listener not yet ready';
  while (Date.now() < deadline) {
    try {
      const res = await fetch(endpoint, { signal: AbortSignal.timeout(5000) });
      const data = await res.json();
      const ready = mode === 'gateway' ? data.ready === true : data.ok === true && data.service === 'career-dashboard';
      if (res.ok && ready) { console.log(mode + ' ready: HTTP ' + res.status); return; }
      last = 'HTTP ' + res.status;
    } catch (error) { last = error.name; }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw Error(mode + ' readiness deadline exceeded: ' + last);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
