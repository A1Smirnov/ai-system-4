'use strict';
// Synthetic normal-harness checks; --model-only explicitly selects the limited inference path.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { call } = require('../personal-system/control/gateway-sdk.cjs');
const root = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'state/openclaw.json')));
if (process.argv.includes('--normal') && process.argv.includes('--model-only')) throw Error('Conflicting execution paths');
const normal = !process.argv.includes('--model-only');
const onlyAgent = process.argv.find(value => value.startsWith('--agent='))?.slice(8);
const excludeAgent = process.argv.find(value => value.startsWith('--exclude='))?.slice(10);
if (onlyAgent && !Object.hasOwn(config.agents.entries, onlyAgent)) throw Error('Unknown agent');
if (excludeAgent && !Object.hasOwn(config.agents.entries, excludeAgent)) throw Error('Unknown excluded agent');
const agents = Object.keys(config.agents.entries).filter(id => (!onlyAgent || id === onlyAgent) && id !== excludeAgent);
const audit = crypto.randomUUID();
const dir = path.join(root, 'outputs', (normal ? 'agent-chat-normal-' : 'agent-chat-check-') + audit);
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
const report = { audit, started_at: new Date().toISOString(), execution_path: normal ? 'normal-harness' : 'model-run', tools_disabled: !normal, tool_use_requested: false, delivery: false, results: [] };
const clean = value => String(value).replace(/(?:sk-[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_.-]{40,})/g, '[REDACTED]').slice(0, 1200);
function save() { fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 2) + '\n', { mode: 0o600 }); }
(async () => {
  console.log('REPORT ' + path.join(dir, 'report.json'));
  const preflight = await call('gateway.restart.preflight', {}, 30000);
  if (!preflight.safe || preflight.counts?.totalActive) throw Error('Active runtime work; diagnostic turns were not started');
  save();
  for (const agent of agents) {
    const key = `agent:${agent}:diagnostic:${audit}`;
    const started = Date.now();
    const row = { agent, model: config.agents.entries[agent].model, session_key: key };
    console.log('START ' + agent);
    try {
      await call('sessions.create', { key, agentId: agent, displayName: 'Chat diagnostic ' + new Date().toISOString().slice(0, 10) }, 30000);
      const result = await call('agent', {
        agentId: agent, sessionKey: key,
        message: `Reply with exactly CHECK_OK ${agent}. This is a synthetic connection check. Do not use tools, access files, delegate tasks, or perform external actions.`,
        ...(normal ? {} : { modelRun: true, promptMode: 'none' }), deliver: false,
        timeout: 90, idempotencyKey: 'chat-diagnostic:' + audit + ':' + agent,
        cleanupBundleMcpOnRunEnd: true
      }, 110000, true);
      const texts = (result.result?.payloads || result.payloads || []).map(p => p.text || '').join('\n');
      row.status = result.status;
      row.reply = clean(texts);
      row.expected_reply_received = texts.trim() === 'CHECK_OK ' + agent;
      row.reply_marker_received = texts.trim().replace(/[.!]$/, '') === 'CHECK_OK ' + agent;
      row.meta = result.result?.meta ? { actual_model: result.result.meta.agentMeta?.model, duration_ms: result.result.meta.durationMs } : undefined;
      row.successful_tools = result.result?.meta?.agentMeta?.terminalReceipt?.successfulToolNames || [];
      if (result.error) row.error = clean(JSON.stringify(result.error));
      if (!texts && result.result?.error) row.error = clean(JSON.stringify(result.result.error));
    } catch (e) { row.status = 'error'; row.error = clean(e.message); }
    row.duration_ms = Date.now() - started;
    report.results.push(row); save();
    console.log(JSON.stringify(row));
    // Never overlap another turn after a transport error with uncertain execution.
    let after = await call('gateway.restart.preflight', {}, 30000);
    const cleanupDeadline = Date.now() + 30000;
    while ((!after.safe || after.counts?.totalActive) && Date.now() < cleanupDeadline) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      after = await call('gateway.restart.preflight', {}, 30000);
    }
    if (!after.safe || after.counts?.totalActive) {
      report.stopped_reason = 'Runtime work still active; no subsequent diagnostic started'; save(); break;
    }
  }
  report.finished_at = new Date().toISOString(); save();
  if (report.results.length !== agents.length || report.results.some(row => row.status !== 'ok' || !row.reply_marker_received)) process.exitCode = 1;
})().catch(e => { report.error = clean(e.message); save(); console.error(report.error); process.exitCode = 1; });
