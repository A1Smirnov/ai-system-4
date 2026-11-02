'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {DatabaseSync,backup}=require('node:sqlite');
const {fixture,source,raw,importJob,prepare}=require('./fixture.cjs');
const discovery=require('../personal-system/control/career-discovery.cjs'),hub=require('../personal-system/control/career-hub.cjs');
const identity=require('../personal-system/control/career-identity.cjs');

/** Deterministic integration scenario. No LLM, mailbox or live ATS/browser calls. */
async function run(){
 const start=performance.now(),cpu=process.cpuUsage(),f=fixture();let sourceRequests=0,networkCalls=0;
 const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{networkCalls++;throw Error('External network is forbidden in the fixture');};
 try{
  const {db,root}=f,items=[];
  for(let i=1;i<=10;i++){
   const provider=['greenhouse','lever','ashby'][(i-1)%3],s=source(i,provider),record=raw(s,i);
   const payload=provider==='greenhouse'?{jobs:[record],meta:{total:1}}:provider==='ashby'?{apiVersion:'1',jobs:[record]}:[record];
   const snapshot=await discovery.download(s,{request_timeout_ms:1000,max_response_bytes:100000,max_jobs_per_source:10},async()=>{sourceRequests++;return new Response(JSON.stringify(payload),{headers:{'content-type':'application/json'}});});
   discovery.applySnapshot(db,s,snapshot,new Date().toISOString());
   items.push({key:s.id+':'+snapshot.jobs[0].source_job_id});
  }
  const original=source(1),alias={...original,id:'fixture-alias'};importJob(db,alias,1);
  const stale=importJob(db,source(91),91,{},new Date(Date.now()-49*3600000).toISOString());
  const closedSource=source(92),closed=importJob(db,closedSource,92);discovery.applySnapshot(db,closedSource,{complete:true,jobs:[],total:0,bytes:0},new Date().toISOString());
  assert.throws(()=>discovery.normalize(source(93),{id:-1,title:'Invalid'}),/Invalid/);
  const excluded=discovery.normalize(source(94),raw(source(94),94,{title:'Account Executive'}));
  assert.equal(discovery.evaluate(excluded).status,'excluded');
  let batches=0,prepared=[];
  for(let i=0;i<10;i++){
   const queue=require('../personal-system/control/career-tools.cjs').queue(db,root);
   if(!queue.jobs.length)break;batches++;
   for(const j of queue.jobs){assert(j.job_key!==stale.key&&j.job_key!==closed.key);const row=db.prepare('SELECT * FROM career_discovery_jobs WHERE job_key=?').get(j.job_key);prepared.push({...prepare(db,{key:j.job_key,row}),job_key:j.job_key});}
  }
  assert.equal(prepared.length,10);
  assert.equal(new Set(prepared.map(p=>identity.canonical(hub.job(db,p.job_key).body.url))).size,10);
  // Exact same source/material/answers reuses the packet, irrespective of created_at.
  for(const p of prepared){const again=hub.preparePacket(db,p.job_key,{automatic:true,material_id:'fixture-pdf',answers:{'Full Name':'Synthetic Candidate'},cover_letter:'Synthetic fixture only. Evidence: fixture-js.'});assert.equal(again.id,p.id);assert.equal(again.reused,true);assert.equal(again.digest,p.digest);}
  assert.equal(db.prepare('SELECT count(*) n FROM career_web_packets').get().n,10);
  assert.equal(require('../personal-system/control/career-tools.cjs').queue(db,root).jobs.length,0);
  for(const p of prepared)assert.throws(()=>hub.requestSubmission(db,p.id),/Owner-approved/);
  assert.equal(db.prepare('SELECT count(*) n FROM career_web_grants').get().n,0);
  assert.equal(db.prepare('SELECT count(*) n FROM career_web_attempts').get().n,0);
  assert.equal(db.prepare('SELECT count(*) n FROM career_send_queue').get().n,0);
  // SQLite online backup includes WAL state. Restore is opened separately, never over live state.
  const restoredFile=path.join(root,'restored.sqlite');await backup(db,restoredFile);
  const restored=new DatabaseSync(restoredFile);
  try{assert.equal(restored.prepare('PRAGMA quick_check').get().quick_check,'ok');assert.equal(restored.prepare('SELECT count(*) n FROM career_web_packets').get().n,10);for(const p of prepared)assert.equal(restored.prepare('SELECT digest FROM career_web_packets WHERE id=?').get(p.id).digest,p.digest);restored.prepare('DELETE FROM career_web_packets WHERE id=?').run(prepared[0].id);assert.equal(db.prepare('SELECT count(*) n FROM career_web_packets').get().n,10);}finally{restored.close();}
  const time=performance.now()-start,usage=process.cpuUsage(cpu);
  return {scenario:'synthetic-local-headhunter-v1',success:true,valid_opportunities:10,prepared_bound_drafts:10,unique_official_identities:10,rerun_new_packets:0,filtered:{stale:1,closed:1,non_engineering:1,invalid:1,duplicate_alias:1},preparation_batches:batches,fixture_source_requests:sourceRequests,external_network_calls:networkCalls,external_actions:0,grants_created:0,duration_ms:time,cpu_ms:(usage.user+usage.system)/1000,rss_bytes:process.memoryUsage().rss,ms_per_draft:time/10,llm_tokens:0,llm_cost_usd:0,human_interventions_during_deterministic_run:0,pdf_quality:'Not evaluated: synthetic header fixtures',model_content_quality:'Not evaluated: no model generation',human_review:'Drafts remain prepared; no approval or submission',restore:'isolated online SQLite backup, integrity and digest equality; mutation isolation passed'};
 }finally{globalThis.fetch=originalFetch;f.close();}
}
module.exports={run};
