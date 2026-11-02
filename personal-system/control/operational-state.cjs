'use strict';
// Fixed metadata only. No other role's mail, task narrative, credentials or transcript.
const fs=require('node:fs'),path=require('node:path');
function load(file){try{return JSON.parse(fs.readFileSync(file));}catch{return null;}}
function freshness(at,now,max=3600000){const age=now-Date.parse(at);return Number.isFinite(age)&&age>=-60000&&age<=max;}
function read(root,now=Date.now()){
 const mail=load(path.join(root,'data/reports/mail-access/latest.json'));
 const checks=load(path.resolve(root,'../outputs/chat-exec-policy-20261031/VERIFIED.json'));
 const tools=load(path.join(root,'data/reports/operator-state/latest.json'));
 const site=load(path.join(root,'data/reports/security-monitor/site-weekly.json'));
 const history=load(path.resolve(root,'../outputs/ubuntu-agent-adaptation-20261031/history-native-read-checks.json'));
 return {kind:'operational-evidence',checked_at:new Date(now).toISOString(),source_ref:'operator:ubuntu-migration-evidence-v1',
  chat_probe:checks?{checked_at:checks.checked_at,fresh:freshness(checks.checked_at,now),responding_agents:Object.entries(checks.normal_chat_agents||{}).filter(([,v])=>v.ok).map(([id])=>id),scope:'Normal chat replies only; no tools, work cycle, autonomy or delivery proved'}:{status:'unverified'},
  mail_access:mail?{checked_at:mail.checked_at,authenticated:mail.authenticated===true,scope:'Mail.Read',fresh:freshness(mail.checked_at,now),evidence:'Actual read-only Graph endpoint; mailbox review coverage is separate'}:{status:'unverified'},
  tool_probes:tools?{checked_at:tools.checked_at,fresh:freshness(tools.checked_at,now),roles:(tools.roles||[]).map(x=>({role:x.role,tool:x.tool,ok:x.ok===true})),scope:'Only listed fixed tools; not full autonomous work cycle'}:{status:'not_yet_verified'},
  native_history:history?{checked_at:history.checked_at,fresh:freshness(history.checked_at,now),readable_agents:(history.results||[]).filter(x=>x.ok===true).map(x=>x.agent),scope:'Native persisted turn metadata read only; no model turns or transcript items returned'}:{status:'not_yet_verified'},
  site_lockfile:site?{checked_at:site.checked_at,revision:site.revision,environment:site.environment,counts:site.dependencies?.vulnerability_counts||null,production_revision:'unverified'}:{status:'not_yet_verified'},
  background:{cron:'disabled_by_owner',career_orchestrator:'not_enabled_by_this_migration',browser_worker:'not_enabled_by_this_migration',backup:'paused_by_owner',scope:'Owner policy, not a live process inventory'},
  backup_verification:'No independent destination or trial restore verified; local rollback copies do not prove backup health',
  interpretation:'Historical errors remain history. Newer evidence supersedes only the same scope. Fresh report assembly does not refresh underlying observations.'};
}
module.exports={read,freshness};
