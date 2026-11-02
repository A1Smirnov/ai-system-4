'use strict';
// Host-side admission. Agent task bodies never select or authorize this budget.
function limits(policy){const p=policy.limits||{},background=p.daily_turns,owner_requested=p.daily_owner_requested_turns??0,total=p.daily_total_turns??background;if(![background,owner_requested,total].every(n=>Number.isInteger(n)&&n>=0)||total<background||total<owner_requested)throw Error('Invalid daily AI budget policy');return {background,owner_requested,total};}
function counts(db,day){const result={background:0,owner_requested:0,total:0};for(const row of db.prepare("SELECT body FROM events WHERE kind='dispatch.started'").all()){const b=JSON.parse(row.body);if(b.local_date!==day)continue;const scope=b.budget_scope==='owner_requested'?'owner_requested':'background';result[scope]++;result.total++;}return result;}
function allowance(db,day,policy,scope='background'){if(!['background','owner_requested'].includes(scope))throw Error('Invalid budget scope');const cap=limits(policy),used=counts(db,day);return {scope,limits:cap,used,remaining:Math.max(0,Math.min(cap[scope]-used[scope],cap.total-used.total))};}
function admit(db,task,day,policy,{scope='background',owner_request_ref}={}){
 if(scope==='owner_requested'&&(typeof owner_request_ref!=='string'||!owner_request_ref.trim()||owner_request_ref.length>600))throw Error('Explicit owner request reference required for a verification run');
 const budget=allowance(db,day,policy,scope),tools=task.route?.tier==='tools';
 db.exec('BEGIN IMMEDIATE');try{
  const current=allowance(db,day,policy,scope);
  if(!tools&&current.remaining<1){db.exec('COMMIT');return {allowed:false,status:'daily_limit',...current};}
  const changed=db.prepare("UPDATE tasks SET status='running',updated_at=? WHERE id=? AND status='queued'").run(new Date().toISOString(),task.id);
  if(changed.changes!==1)throw Error('Task is not queued; never repeat an existing attempt');
  const body={local_date:day,owner:task.owner,route:task.route,budget_scope:scope,...(scope==='owner_requested'?{owner_request_ref}: {})};
  db.prepare('INSERT INTO events(kind,entity,body,created_at) VALUES(?,?,?,?)').run(tools?'tools.started':'dispatch.started',task.id,JSON.stringify(body),new Date().toISOString());
  db.exec('COMMIT');return {allowed:true,...current};
 }catch(e){if(db.isTransaction)db.exec('ROLLBACK');throw e;}
}
module.exports={limits,counts,allowance,admit};
