'use strict';
// Draft evidence only. This module never grants approval or queues transport.
const hub=require('./career-hub.cjs');
const TTL=30*60000;
function migrate(db){db.exec(`CREATE TABLE IF NOT EXISTS career_draft_form_snapshots(id INTEGER PRIMARY KEY,job_key TEXT NOT NULL,source_hash TEXT NOT NULL,checked_at TEXT NOT NULL,body TEXT NOT NULL);CREATE INDEX IF NOT EXISTS career_draft_form_lookup ON career_draft_form_snapshots(job_key,id DESC);`);}
function latest(db,job,at=Date.now()){
 migrate(db);
 const row=db.prepare('SELECT body FROM career_draft_form_snapshots WHERE job_key=? ORDER BY id DESC LIMIT 1').get(job.job_key);
 if(!row)return {status:'not_inspected',questions:[],submission_authority:false};
 const value=JSON.parse(row.body),age=at-Date.parse(value.checked_at);
 if(value.source_hash!==job.content_hash)return {status:'source_changed',questions:[],submission_authority:false};
 return {...value,status:!Number.isFinite(age)||age< -5000||age>TTL?'stale':value.status,submission_authority:false};
}
async function capture(db,root,jobs,{inspect=require('./career-form-preflight.cjs').inspect,at=Date.now(),force=false}={}){
 migrate(db);const results=[];
 for(const input of jobs.slice(0,6)){
  const job=hub.job(db,input.job_key);if(job.content_hash!==input.content_hash){results.push({job_key:job.job_key,status:'source_changed'});continue;}
  const cached=latest(db,job,at);if(!force&&['captured','unavailable'].includes(cached.status)){results.push({job_key:job.job_key,status:cached.status,cached:true});continue;}
  let value;
  try{
   const check=await inspect(root,job,{destination:hub.destination(job.body),answers:{}});
   if(check.job_key!==job.job_key||check.source_hash!==job.content_hash||!Array.isArray(check.fields))throw Error('Form snapshot does not match the requested vacancy');
   const available=check.form_available!==false&&check.form_identity_matches!==false;
   value={status:available?'captured':'unavailable',job_key:job.job_key,source_hash:job.content_hash,checked_at:new Date(at).toISOString(),url:check.url,form_hash:check.form_hash,questions:available?check.fields.map(f=>({label:f.label,description:f.description||'',type:f.type,tag:f.tag,role:f.role,required:f.required_known===false?null:f.required===true,required_status:f.required_known===false?'unknown':f.required?'required':'optional',selection_min:f.selection_min,selection_max:f.selection_max,options:f.options,options_status:f.options_status,options_complete:f.options_complete})):[],limitations:['Native input/textarea/select and supported Ashby yes/no/radio/checkbox groups; unsupported custom controls may be absent.','This is draft evidence; submission always needs a separate fresh form check.'],submission_authority:false};
  }catch{value={status:'unavailable',job_key:job.job_key,source_hash:job.content_hash,checked_at:new Date(at).toISOString(),questions:[],reason:'Could not inspect the exact application form; do not invent questions or answers.',submission_authority:false};}
  db.prepare('INSERT INTO career_draft_form_snapshots(job_key,source_hash,checked_at,body) VALUES(?,?,?,?)').run(job.job_key,job.content_hash,value.checked_at,JSON.stringify(value));results.push({job_key:job.job_key,status:value.status,cached:false});
 }
 return results;
}
module.exports={TTL,migrate,latest,capture};
