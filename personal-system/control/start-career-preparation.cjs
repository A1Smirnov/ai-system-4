'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function ready(){return !!(await fetch('http://127.0.0.1:18789/readyz',{signal:AbortSignal.timeout(2000)}).catch(()=>null))?.ok;}
function processCount(entry){const normalizedEntry=entry.split(path.sep).join('/').replace(/'/g,"''"),command="$entry='"+normalizedEntry+"'; @(Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -and $_.CommandLine.Replace([char]92,[char]47).Contains($entry) -and $_.CommandLine -match '\\bgateway\\s+run\\b' }).Count";return Number(cp.execFileSync('powershell.exe',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true,timeout:20000}).trim());}
async function start(root=path.resolve(__dirname,'..'),{checkOnly=false}={}){
 if(!checkOnly)await require('./start-career-browser-worker.cjs').start(root);
 if(checkOnly)return {status:await ready()?'ready':'awaiting_runtime',check_only:true,existing_gateway_processes:processCount(path.resolve(root,'../app/node_modules/openclaw/openclaw.mjs'))};
 if(!await ready()){
  const base=path.resolve(root,'..'),entry=path.join(base,'app/node_modules/openclaw/openclaw.mjs');
  // Read process metadata to avoid starting a second Gateway that is still warming up.
  let count;try{count=processCount(entry);}catch{return {status:'awaiting_runtime',reason:'Cannot verify existing Gateway processes'};}
  if(!Number.isFinite(count))throw Error('Cannot confirm existing Gateway processes');
  if(!count){const stamp=new Date().toISOString().replace(/[:.]/g,'-'),out=fs.openSync(path.join(base,'logs','career-gateway-'+stamp+'-out.log'),'a'),error=fs.openSync(path.join(base,'logs','career-gateway-'+stamp+'-error.log'),'a');try{const child=cp.spawn(process.execPath,[entry,'gateway','run'],{cwd:base,env:{...process.env,OPENCLAW_HOME:base,OPENCLAW_STATE_DIR:path.join(base,'state'),OPENCLAW_CONFIG_PATH:path.join(base,'state/openclaw.json'),OPENCLAW_SKIP_CRON:'1'},windowsHide:true,detached:true,stdio:['ignore',out,error]});child.unref();}finally{fs.closeSync(out);fs.closeSync(error);}}
  const deadline=Date.now()+600000;while(Date.now()<deadline&&!await ready())await sleep(1000);
 }
 return require('./start-career-orchestrator.cjs').start(root);
}
module.exports={start,ready};if(require.main===module)start(process.argv[2],{checkOnly:process.argv.includes('--check')}).then(x=>{console.log(JSON.stringify({status:x.status,pid:x.pid,task_id:x.task_id,prepared_packets:x.prepared_packets,check_only:x.check_only,existing_gateway_processes:x.existing_gateway_processes}));if(['error','awaiting_runtime'].includes(x.status))process.exitCode=1;}).catch(e=>{console.error(e.message);process.exitCode=1;});
