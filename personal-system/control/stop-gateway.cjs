'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),{pathToFileURL}=require('node:url'),r=require('./registry.cjs'),g=require('./gateway-rpc.cjs');
async function stop(){
 cp.execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',"$ErrorActionPreference='Stop';$t=Get-ScheduledTask -TaskPath '\\OpenClawPersonal\\' -TaskName Dispatcher -ErrorAction SilentlyContinue;if($t){Disable-ScheduledTask -InputObject $t|Out-Null}"],{windowsHide:true,timeout:20000});
 if(fs.existsSync(path.join(r.ROOT,'data','work.lock')))throw Error('Background work holds the lock. Wait for its bounded turn; no process was terminated. Dispatcher is paused.');
 const preflight=await g.call('gateway.restart.preflight');if(!preflight.safe||preflight.counts?.totalActive)throw Error('Active work exists. Ask main-1 to record its checkpoint first, then retry. Dispatcher is paused.');
 const sessions=await g.command(['sessions','--all-agents','--json','--limit','all']);
 const db=r.open();try{r.atomic(path.join(r.ROOT,'data','shutdown-checkpoint.json'),{checked_at:new Date().toISOString(),reason:'Owner-requested safe stop',active_work:preflight.counts,tasks:r.overview(db),sessions});}finally{db.close();}
 // Read-only identity resolver shipped by this verified installed OpenClaw release.
 const core=await import(pathToFileURL(g.BASE+'/app/node_modules/openclaw/dist/gateway-lock-B6mKYs2x.mjs'));
 const identity=await core.o({env:g.env,timeoutMs:5000});
 if(!identity||identity.port!==18789)throw Error('Cannot verify the owner of the expected local Gateway; no stop request sent.');
 const reply=await g.call('gateway.stop.request',{target:{pid:identity.pid,ownerId:identity.ownerId,port:identity.port}});
 const deadline=Date.now()+390000;let stopped=false;
 while(Date.now()<deadline){try{process.kill(identity.pid,0);}catch(e){if(e.code==='ESRCH'){stopped=true;break;}throw e;}await new Promise(resolve=>setTimeout(resolve,1000));}
 if(!stopped)throw Error('Stop was requested but process exit is not verified. Do not start another Gateway. Inspect current status.');
 r.atomic(path.join(r.ROOT,'data','gateway-state.json'),{checked_at:new Date().toISOString(),status:'stopped',stop_method:'authenticated target-bound host lifecycle RPC',pid:identity.pid});
 console.log(JSON.stringify({status:'stopped',pid:identity.pid,checkpoint:'personal-system/data/shutdown-checkpoint.json',dispatcher:'paused',security_collectors:'independent; left enabled',reply_status:reply.status}));
}
stop().catch(e=>{console.error(e.message);process.exitCode=1;});
