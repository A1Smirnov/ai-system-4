'use strict';
// Local read/negative checks only. No model calls, maintenance bootstrap or policy writes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),cp=require('node:child_process');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
async function check(){
 const config=JSON.parse(fs.readFileSync(path.join(root,'state/openclaw.json')));
 const dist=path.join(root,'app/node_modules/openclaw/dist');
 // Audit adapters are deliberately pinned to this inspected installed build.
 const policyFile=path.join(dist,'agent-tools.policy-B-XJsXps.mjs'),matchFile=path.join(dist,'tool-policy-match-BXLYReRw.mjs');
 const resolver=await import(pathToFileURL(policyFile).href),matcher=await import(pathToFileURL(matchFile).href);
 const denied=['exec','process','read','write','edit','apply_patch','browser','gateway','nodes','message','sessions_send','sessions_history','sessions_spawn','secrets','code_execution'];
 const roles=Object.keys(config.agents.entries).map(id=>{
  const p=resolver.n({config,agentId:id,sessionKey:'agent:'+id+':engineering-audit'});
  const policies=[p.globalPolicy,p.agentPolicy,p.globalProviderPolicy,p.agentProviderPolicy];
  const unexpectedlyAllowed=denied.filter(name=>matcher.o(name,policies));
  assert.deepEqual(unexpectedlyAllowed,[],id+' unexpectedly permits a forbidden native tool');
  return {id,profile:p.profile,denied_checks:denied.length,unexpectedly_allowed:unexpectedlyAllowed};
 });
 assert.equal(config.tools.sessions.visibility,'self');assert.equal(config.tools.agentToAgent.enabled,false);assert.equal(config.cron.enabled,false);
 const services={};
 for(const name of ['ai-system.target','ai-system-gateway.service','ai-system-dashboard.service']){
  const r=cp.spawnSync('systemctl',['--user','show',name,'--property=ActiveState,SubState,MainPID'],{encoding:'utf8'});assert.equal(r.status,0);services[name]=Object.fromEntries(r.stdout.trim().split('\n').map(line=>line.split('=')));assert.equal(services[name].ActiveState,'active');
 }
 const workers=Object.fromEntries(['dispatcher-v2.cjs','career-orchestrator.cjs','career-worker.cjs','career-browser-worker.cjs'].map(name=>[name,0]));
 for(const entry of fs.readdirSync('/proc').filter(name=>/^\d+$/.test(name)))try{
  const args=fs.readFileSync('/proc/'+entry+'/cmdline','utf8').split('\0');
  for(const name of Object.keys(workers))if(args.includes(path.join(root,'personal-system/control',name)))workers[name]++;
 }catch{ /* Processes may finish while being observed. */ }
 const ready=await fetch('http://127.0.0.1:18789/readyz');assert.equal(ready.status,200);
 const dashboard='http://127.0.0.1:18795',home=await fetch(dashboard+'/');assert.equal(home.status,200);const cookie=home.headers.get('set-cookie').split(';')[0];
 const campaign=await(await fetch(dashboard+'/api/campaign',{headers:{cookie}})).json();assert.equal(campaign.runtime.read_only,true);
 const overview=await(await fetch(dashboard+'/api/overview',{headers:{cookie}})).json();
 const campaignFile=path.join(root,'personal-system/data/career-campaign.json'),before=sha(campaignFile);
 const response=await fetch(dashboard+'/api/campaign/pause',{method:'POST',headers:{cookie,Origin:dashboard,'Content-Type':'application/json','X-Career-CSRF':overview.csrf},body:'{}'});
 assert.equal(response.status,403);assert.match((await response.json()).error,/Read-only/);assert.equal(sha(campaignFile),before);
 return {checked_at:new Date().toISOString(),services,gateway_ready_http:ready.status,dashboard_http:home.status,read_only_mutation_with_valid_session_and_csrf_http:response.status,campaign_policy_unchanged:true,roles,native_matcher_files:{[path.basename(policyFile)]:sha(policyFile),[path.basename(matchFile)]:sha(matchFile)},worker_processes:workers,cron_enabled:config.cron.enabled,session_visibility:config.tools.sessions.visibility,agent_to_agent_enabled:config.tools.agentToAgent.enabled,scope:'Installed native runtime matcher, live services and dashboard; not OS isolation or an LLM prompt-injection proof',model_calls:0};
}
check().then(result=>{if(!process.argv[2])throw Error('Private output.json required');fs.writeFileSync(path.resolve(process.argv[2]),JSON.stringify(result,null,2)+'\n',{mode:0o600});console.log(JSON.stringify({roles:result.roles.length,services:'active',gateway_http:result.gateway_ready_http,dashboard_http:result.dashboard_http,mutation_http:result.read_only_mutation_with_valid_session_and_csrf_http,workers:result.worker_processes}));}).catch(e=>{console.error(e.message);process.exitCode=1;});
