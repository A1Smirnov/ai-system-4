'use strict';
// Local owner entry point; deliberately absent from the MCP tool catalog.
const fs=require('node:fs'),path=require('node:path');
async function run(root,id,owner_request_ref){
 if(!id||!owner_request_ref)throw Error('Provide one queued task ID and its explicit owner request reference');
 const r=require(path.join(root,'control/registry.cjs')),d=require(path.join(root,'control/dispatcher-v2.cjs')),budget=require(path.join(root,'control/ai-budget.cjs')),rpc=require(path.join(root,'control/gateway-rpc.cjs'));
 const health=await fetch('http://127.0.0.1:18789/readyz',{signal:AbortSignal.timeout(3000)});if(!health.ok)throw Error('Gateway is not ready');
 const preflight=await rpc.call('gateway.restart.preflight');if(!preflight.safe||preflight.counts?.totalActive)throw Error('Runtime is busy; no automatic retry');
 const lock=path.join(root,'data/work.lock'),fd=fs.openSync(lock,'wx');fs.writeFileSync(fd,JSON.stringify({pid:process.pid,purpose:'One explicit owner verification task',created_at:new Date().toISOString()}));
 let db;try{db=r.open(root);const task=db.prepare("SELECT * FROM tasks WHERE id=? AND status='queued'").get(id);if(!task)throw Error('Queued exact task required; prior attempts are not resumed');const roles=r.readJSON(path.join(root,'control/roles.json')),day=d.localParts(new Date()).date,a=budget.allowance(db,day,require(path.join(root,'control/routing.cjs')).policy(root),'owner_requested'),batch=d.selectBatch([task],roles,1,a.remaining);if(!batch.length)return {status:'daily_limit_or_unavailable_role',budget:a};return await d.execute(db,batch[0],roles,day,{root,scope:'owner_requested',owner_request_ref});}finally{db?.close();fs.closeSync(fd);fs.unlinkSync(lock);}
}
module.exports={run};if(require.main===module)run(path.resolve(__dirname,'..'),process.argv[2],process.argv[3]).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;});
