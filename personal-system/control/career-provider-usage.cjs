'use strict';
// Read only usage/error metadata from the Headhunter-owned Codex transcripts.
// This module never reads auth files, invokes a model, or changes credentials.
const fs=require('node:fs'),path=require('node:path');
const MAX_BYTES=2*1024*1024,MAX_FILES=8;
function finite(n){return typeof n==='number'&&Number.isFinite(n)&&n>=0?n:null;}
function windowValue(w){if(!w||finite(w.used_percent)===null)return null;return {used_percent:w.used_percent,window_minutes:finite(w.window_minutes),resets_at:finite(w.resets_at)};}
function parse(text){let quota=null,usage=null,error=null;for(const line of text.split(/\r?\n/)){let e;try{e=JSON.parse(line);}catch{continue;}if(e.type!=='event_msg'||!e.payload)continue;const p=e.payload;if(p.type==='token_count'){
  if(p.rate_limits?.limit_id==='codex')quota={observed_at:e.timestamp,plan_type:typeof p.rate_limits.plan_type==='string'?p.rate_limits.plan_type:null,primary:windowValue(p.rate_limits.primary),secondary:windowValue(p.rate_limits.secondary)};
  const u=p.info?.total_token_usage;if(u&&finite(u.total_tokens)!==null)usage={observed_at:e.timestamp,input_tokens:finite(u.input_tokens),cached_input_tokens:finite(u.cached_input_tokens),output_tokens:finite(u.output_tokens),reasoning_output_tokens:finite(u.reasoning_output_tokens),total_tokens:u.total_tokens};
 }if(p.type==='task_complete'&&p.error){const code=p.error.codex_error_info;if(['usage_limit_exceeded','rate_limit_exceeded'].includes(code))error={observed_at:e.timestamp,code};}}
 return {quota,usage,error};}
function decision(snapshot,now=Date.now()){
 const q=snapshot?.quota;if(!q||!Number.isFinite(Date.parse(q.observed_at))||Date.parse(q.observed_at)>now+300000)return {blocked:false,status:'unknown',reason:'Current external quota is not established'};
 const full=[q.primary,q.secondary].filter(w=>w&&w.used_percent>=100&&w.resets_at!==null&&w.resets_at*1000>now);
 if(full.length)return {blocked:true,status:'provider_limit',code:'provider_usage_limit',retry_after:new Date(Math.max(...full.map(w=>w.resets_at*1000))).toISOString(),reason:'Codex subscription allowance was observed at 100%; its reported reset is still in the future'};
 if([q.primary,q.secondary].some(w=>w&&w.used_percent>=100))return {blocked:false,status:'unknown',reason:'Historical full window has reset or has no reliable reset; current availability is unknown'};
 if(now-Date.parse(q.observed_at)>15*60000)return {blocked:false,status:'unknown',reason:'External quota observation is older than 15 minutes'};
 return {blocked:false,status:'observed_available',reason:'Recent Codex observation is below 100%; this does not reserve provider capacity'};
}
function files(root){const base=path.resolve(root,'../state/agents/headhunter-1/agent/codex-home/sessions'),found=[];if(!fs.existsSync(base))return found;let visits=0;function walk(dir,depth){if(depth>3||++visits>1000)return;for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(e.isDirectory()&&/^\d{2,4}$/.test(e.name))walk(path.join(dir,e.name),depth+1);else if(e.isFile()&&/^rollout-.*\.jsonl$/.test(e.name)){const file=path.join(dir,e.name),stat=fs.statSync(file);found.push({file,mtime:stat.mtimeMs,size:stat.size});}}}walk(base,0);return found.sort((a,b)=>b.mtime-a.mtime).slice(0,MAX_FILES);}
function readBounded(file,size){const fd=fs.openSync(file,'r');try{const head=Buffer.alloc(Math.min(65536,size));fs.readSync(fd,head,0,head.length,0);const start=Math.max(0,size-MAX_BYTES),tail=Buffer.alloc(size-start);fs.readSync(fd,tail,0,tail.length,start);let text=tail.toString('utf8');if(start)text=text.slice(text.indexOf('\n')+1);return {head:head.toString('utf8'),text};}finally{fs.closeSync(fd);}}
function inspect(root,{taskId,now=Date.now()}={}){let selected=null,candidates;try{candidates=files(root);}catch{return {checked_at:new Date(now).toISOString(),source:null,quota:null,usage:null,error:null,decision:{blocked:false,status:'unknown',reason:'Headhunter usage metadata is unavailable'}};}for(const f of candidates){let text;try{text=readBounded(f.file,f.size);}catch{continue;}if(taskId&&!text.head.includes(taskId)&&!text.text.includes(taskId))continue;const parsed=parse(text.text);if(!parsed.quota&&!parsed.usage&&!parsed.error)continue;const stamp=Math.max(...[parsed.quota?.observed_at,parsed.usage?.observed_at,parsed.error?.observed_at].map(x=>Date.parse(x)||0));if(!selected||stamp>selected.stamp)selected={source:f.file,...parsed,stamp};}
 const result={checked_at:new Date(now).toISOString(),source:selected?.source||null,quota:selected?.quota||null,usage:selected?.usage||null,error:selected?.error||null};result.decision=decision(result,now);return result;}
module.exports={parse,decision,inspect};
