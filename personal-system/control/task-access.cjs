'use strict';

// This is an output boundary, not a prompt-based redactor. Never copy narrative
// fields from another role, even when a legacy task claims to be public.
const VERSION='task-boundary-20261019-v1';
const STATUSES=new Set(['queued','running','completed','partial','error','awaiting_access','awaiting_data','awaiting_decision','unverified']);
const OPERATIONS=new Set(['coordinate','develop','analyze','draft','review','classify','extract','summarize_preliminary','check','collect','calculate']);
const CATEGORIES=new Set(['private_mail','resume','client_material','security_reports','site_aggregate','public','synthetic']);
const DOMAINS=new Map([
 ['main-1','coordination'],['mail-1','mail'],['backup-1','backup'],
 ['security-1','security'],['headhunter-1','career'],['clients-1','client-acquisition'],
 ['webdev-1','development'],['security-web-1','site-security'],
 ['analytics-1','analytics'],['elder-1','improvement']
]);
function object(value){try{const parsed=typeof value==='string'?JSON.parse(value):value;return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{};}catch{return {};}}
function date(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;}
function status(value){return STATUSES.has(value)?value:'unverified';}
function provenance(row,body){return row.owner==='mail-1'||body.data_category==='private_mail'?'untrusted-derived-mail':Array.isArray(body.sources)&&body.sources.some(x=>x?.type==='external')?'untrusted-derived-data':'agent-report-not-owner-authority';}
function coordination(row,body,result){
 const exists=result!==null,p=provenance(row,body);
 return {
  id:row.id,owner:row.owner,domain:DOMAINS.get(row.owner)||'restricted',
  objective:'Task content is available to its assigned agent; the coordinator receives metadata only.',
  status:status(row.status),updated_at:date(row.updated_at),deadline:date(body.deadline),
  operation:OPERATIONS.has(body.operation)?body.operation:null,
  data_category:CATEGORIES.has(body.data_category)?body.data_category:'restricted',
  view:'coordination_metadata',content_restricted:true,policy_version:VERSION,
  provenance:p,authority:'none',
  latest_result:exists?{
   status:status(result.status),verified:false,
   needs_owner:typeof result.needs_owner==='boolean'?result.needs_owner:null,
   finished_at:date(result.finished_at),provenance:p,authority:'none',
   summary:'Result text is available only to the assigned agent.',
   next_action:result.needs_owner===true?'An owner decision is required; details remain with the assigned agent.':'Check status and deadlines; details remain with the assigned agent.'
  }:null
 };
}
function project(row,resultBody,role,detail){
 const body=object(row.body),result=resultBody===null?null:object(resultBody);
 if(row.owner!==role){
  if(role!=='main-1')throw Error('Task is outside role scope');
  return coordination(row,body,result);
 }
 const value={...row,body,latest_result:result,provenance:provenance(row,body),authority:'none',view:detail?'assigned_task':'assigned_summary'};
 if(!detail){
  delete value.body;value.objective=String(value.objective??'').slice(0,250);
  if(result)value.latest_result={status:result.status,summary:String(result.summary??'').slice(0,300),next_action:String(result.next_action??'').slice(0,1000),needs_owner:typeof result.needs_owner==='boolean'?result.needs_owner:null,finished_at:date(result.finished_at),provenance:value.provenance,authority:'none'};
 }
 return value;
}
function validateListArguments(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>k!=='task_id'))throw Error('Only task_id is accepted; role and view are server-controlled');
 if(Object.hasOwn(input,'task_id')&&(typeof input.task_id!=='string'||!input.task_id.trim()||input.task_id.length>100))throw Error('Invalid task_id');
 return input.task_id;
}
module.exports={VERSION,project,validateListArguments};
