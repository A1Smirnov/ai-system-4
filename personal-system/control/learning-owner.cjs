'use strict';
// Owner-only host CLI. This module is deliberately absent from MCP tool dispatch.
const fs=require('node:fs'),path=require('node:path'),r=require('./registry.cjs'),l=require('./learning.cjs');
const args=process.argv.slice(2),cmd=args.shift()||'status',positionals=[],flags={};for(let i=0;i<args.length;i++){if(args[i].startsWith('--'))flags[args[i].slice(2)]=args[++i];else positionals.push(args[i]);}
const root=flags['fixture-root']?path.resolve(flags['fixture-root']):r.ROOT;
if(root!==r.ROOT&&!fs.existsSync(path.join(root,'SYNTHETIC_LEARNING_FIXTURE')))throw Error('Explicit synthetic fixture marker required');
async function idleForWrite(){if(root!==r.ROOT)return;if(flags.sandbox)throw Error('Synthetic apply must use a separate fixture registry');if(fs.existsSync(path.join(root,'data','work.lock')))throw Error('Dispatcher is active; stop it before a live memory write');let responding=false;try{await fetch('http://127.0.0.1:18789/readyz',{signal:AbortSignal.timeout(2000)});responding=true;}catch(e){if(e.cause?.code!=='ECONNREFUSED')throw Error('Cannot prove Gateway is stopped');}if(responding)throw Error('Stop Gateway before live apply/withdraw/recovery, so partial files cannot enter a model context');const cp=require('node:child_process');const count=cp.execFileSync('powershell.exe',['-NoProfile','-Command',"$ErrorActionPreference='Stop';@(Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object {$_.CommandLine -match '[\\\\/]OpenClaw[\\\\/].*(?:openclaw\\.mjs|entry\\.js).*gateway\\s+run'}).Count"],{encoding:'utf8',windowsHide:true,timeout:20000}).trim();if(count!=='0')throw Error('Gateway may be starting; wait for a verified stop');}
async function main(){const db=r.open(root);try{let result;const iid=positionals[0];switch(cmd){
 case 'status':result=l.status(db,root);break;
 case 'list':result=db.prepare('SELECT id,owner,kind,state,version,sha256,updated_at FROM learning_items ORDER BY updated_at DESC LIMIT 50').all();break;
 case 'show':{const item=l.get(db,iid);result={...item,checks:db.prepare('SELECT body FROM learning_checks WHERE item_id=? ORDER BY created_at DESC LIMIT 5').all(item.id).map(x=>JSON.parse(x.body)),decisions:db.prepare('SELECT sha256,action,actor,created_at FROM learning_decisions WHERE item_id=? ORDER BY created_at DESC').all(item.id),applications:db.prepare('SELECT id,sha256,state,created_at FROM learning_applications WHERE item_id=?').all(item.id)};break;}
 case 'feedback':result=l.feedback(db,JSON.parse(fs.readFileSync(flags.file,'utf8').replace(/^\uFEFF/,'')));break;
 case 'candidate':{const row=db.prepare("SELECT body FROM learning_sources WHERE id=? AND trust='explicit_owner'").get(flags.source);if(!row)throw Error('Existing explicit owner source required');const b=JSON.parse(row.body);result=l.proposeNote(db,r.checkRole(flags.owner||'main-1'),{text:JSON.stringify({statement:b.statement,scope:b.scope,subtype:flags.subtype||b.feedback_kind,source_ids:[flags.source],observed_at:b.observed_at,reconsider_when:'Owner correction or source change'}),source_ref:flags.source});break;}
 case 'check':result=l.check(db,iid);break;
 case 'approve':case 'reject':result=l.decide(db,iid,cmd,flags.sha,flags.reason||'Explicit decision by owner at local console');break;
 case 'revise':result=l.revise(db,iid,JSON.parse(fs.readFileSync(flags.file,'utf8').replace(/^\uFEFF/,'')));break;
 case 'apply':await idleForWrite();result=l.apply(root,db,iid,flags.sha,{sandbox:flags.sandbox});break;
 case 'withdraw':await idleForWrite();result=l.withdraw(root,db,iid,flags.sha);break;
 case 'recover':await idleForWrite();result=l.recoverLocked(root,db);break;
 default:throw Error('Commands: status | list | show ID | feedback --file JSON | candidate --source ID --owner ROLE --subtype fact|decision|preference | check ID | approve|reject ID --sha HASH --reason TEXT | revise ID --file JSON | apply ID --sha HASH | withdraw ID --sha HASH | recover');
 }console.log(JSON.stringify(result,null,2));}finally{db.close();}}
main().catch(e=>{console.error(e.message);process.exitCode=1});
