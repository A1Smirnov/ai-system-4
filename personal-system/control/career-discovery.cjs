'use strict';
// Owner-approved public GET collector. Never a sender, browser, or arbitrary URL tool.
const fs = require('node:fs');
const geography=require('./career-geography.cjs');
const path = require('node:path');
const crypto = require('node:crypto');
const {DatabaseSync} = require('node:sqlite');
const digest = x => crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const iso = x => Number.isFinite(Date.parse(x)) ? new Date(x).toISOString() : null;
const validSlug = x => typeof x === 'string' && /^[a-z0-9][a-z0-9_-]{0,99}$/i.test(x);
function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); }
function atomic(file, data) {
  fs.mkdirSync(path.dirname(file), {recursive:true});
  const temp = file + '.' + crypto.randomUUID() + '.tmp';
  try { fs.writeFileSync(temp, data, {flag:'wx', mode:0o600}); fs.renameSync(temp, file); }
  finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
}
function text(html, max = 48000) {
  let s = String(html || '').slice(0, 250000);
  for (let i=0; i<2; i++) s = s.replace(/&(?:#(\d+)|#x([\da-f]+)|([a-z]+));/gi, (m,d,h,n) => {
    if (d || h) { const v=parseInt(d || h, d ? 10 : 16); return v>0 && v<=0x10ffff ? String.fromCodePoint(v) : ''; }
    return ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '})[n.toLowerCase()] ?? m;
  });
  return s.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ')
    .replace(/<\/?(?:p|br|li|div|h[1-6])\b[^>]*>/gi,'\n').replace(/<[^>]*>/g,' ')
    .replace(/[\t ]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim().slice(0,max);
}
function sourceIdentity(source) {return source.provider+':'+String(source.board).toLowerCase();}
function sourceUrl(source,skip=0,limit=100) {
  if(!['greenhouse','lever','ashby'].includes(source.provider)||!validSlug(source.board)||!validSlug(source.id))throw Error('Invalid approved ATS source');
  if(source.provider==='greenhouse')return `https://boards-api.greenhouse.io/v1/boards/${source.board}/jobs?content=true`;
  if(source.provider==='ashby')return `https://api.ashbyhq.com/posting-api/job-board/${source.board}?includeCompensation=true`;
  if(!Number.isSafeInteger(skip)||skip<0||!Number.isSafeInteger(limit)||limit<1||limit>100)throw Error('Invalid pagination');
  return `https://api.lever.co/v0/postings/${source.board}?mode=json&skip=${skip}&limit=${limit}`;
}
function validateConfig(config, policy) {
  if (!policy.confirmed || policy.search_programs?.join(',') !== 'engineering' || policy.outbound_enabled !== false || policy.auto_apply_enabled !== false) throw Error('Confirmed engineering-only read-only policy required');
  if(config.timezone!=='America/Los_Angeles'||!Number.isInteger(config.daily_after_hour)||config.daily_after_hour<0||config.daily_after_hour>23)throw Error('Invalid collection schedule');
  if(!Array.isArray(config.sources)||config.sources.length>500||!Number.isInteger(config.max_sources)||config.max_sources<1||config.max_sources>200)throw Error('Invalid bounded source list');
  for(const [key,min,max,fallback]of[['request_timeout_ms',100,20000],['max_response_bytes',1024,16777216],['max_jobs_per_source',1,10000],['concurrency',1,6,1],['max_pages_per_source',1,100,30],['max_requests_per_run',1,2000,600],['run_timeout_ms',1000,300000,180000]]){
    const value=config[key]??fallback;if(!Number.isInteger(value)||value<min||value>max)throw Error('Invalid '+key);
  }
  const ids=new Set(),boards=new Set();
  for(const s of config.sources){sourceUrl(s);const key=sourceIdentity(s);
    if(ids.has(s.id.toLowerCase())||boards.has(key)||typeof s.employer!=='string'||!s.employer.trim()||s.employer.length>120||typeof s.enabled!=='boolean')throw Error('Invalid or duplicate source');
    ids.add(s.id.toLowerCase());boards.add(key);
  }
}

function migrate(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS career_discovery_sources(source_id TEXT PRIMARY KEY,body TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS career_discovery_jobs(job_key TEXT PRIMARY KEY,source_id TEXT NOT NULL,source_job_id TEXT NOT NULL,content_hash TEXT NOT NULL,first_seen_at TEXT NOT NULL,last_seen_at TEXT NOT NULL,availability TEXT NOT NULL,body TEXT NOT NULL,opportunity_id TEXT,UNIQUE(source_id,source_job_id));
  CREATE TABLE IF NOT EXISTS career_discovery_runs(id TEXT PRIMARY KEY,started_at TEXT NOT NULL,finished_at TEXT,status TEXT NOT NULL,body TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS career_discovery_decisions(id INTEGER PRIMARY KEY,job_key TEXT NOT NULL,decision TEXT NOT NULL,created_at TEXT NOT NULL);`);
}
function requiredString(value,name,max=1000000){if(typeof value!=='string'||!value.trim()||value.length>max)throw Error('Invalid or incomplete job record: '+name);return value;}
function postingId(value){if(typeof value!=='string'||!/^[a-z0-9][a-z0-9_-]{0,127}$/i.test(value))throw Error('Invalid posting ID');return value;}
function countryName(value){return /^(US|USA)$/i.test(value||'')?'United States':typeof value==='string'?value:'';}
function normalize(source, raw) {
  if(!raw||typeof raw!=='object')throw Error('Invalid or incomplete job record');
  let id,title,location,description,url,updated,published;
  if(source.provider==='greenhouse'){
    if(!Number.isSafeInteger(raw.id)||raw.id<1||typeof raw.content!=='string')throw Error('Invalid or incomplete job record');
    requiredString(raw.title,'title',1000);if(raw.internal_job_id===null)return null;
    id=String(raw.id);title=raw.title;location=raw.location?.name||'';description=raw.content;url=`https://job-boards.greenhouse.io/${source.board}/jobs/${id}`;updated=raw.updated_at;published=raw.first_published;
  }else if(source.provider==='lever'){
    id=postingId(raw.id);title=requiredString(raw.text,'title',1000);
    const main=raw.descriptionPlain??raw.description;if(typeof main!=='string'||!main.trim())throw Error('Invalid or incomplete job record: description');
    const lists=raw.lists??[];if(!Array.isArray(lists)||lists.length>100)throw Error('Invalid job lists');
    description=[main,...lists.map(x=>requiredString(x?.text,'list title',1000)+'\n'+requiredString(x?.content,'list content')),raw.additionalPlain??raw.additional??''].join('\n');
    if(raw.categories?.allLocations!==undefined&&!Array.isArray(raw.categories.allLocations))throw Error('Invalid locations');
    location=[...new Set([raw.categories?.location,...(raw.categories?.allLocations||[]),countryName(raw.country),raw.workplaceType==='remote'?'Remote':''].filter(Boolean))].join(' · ');
    url=`https://jobs.lever.co/${source.board}/${id}`;published=Number.isSafeInteger(raw.createdAt)?new Date(raw.createdAt).toISOString():raw.createdAt;
  }else if(source.provider==='ashby'){
    title=requiredString(raw.title,'title',1000);description=raw.descriptionPlain??raw.descriptionHtml;if(typeof description!=='string'||!description.trim())throw Error('Invalid or incomplete job record: description');
    const candidate=new URL(requiredString(raw.jobUrl,'job URL',2000));
    if(candidate.protocol!=='https:'||candidate.hostname!=='jobs.ashbyhq.com'||candidate.username||candidate.password||candidate.port||candidate.search||candidate.hash)throw Error('Invalid Ashby job URL');
    const parts=candidate.pathname.split('/').filter(Boolean);
    if(parts.length!==2||decodeURIComponent(parts[0]).toLowerCase()!==source.board.toLowerCase())throw Error('Invalid Ashby board path');
    id=postingId(parts[1]);if(raw.id!==undefined&&raw.id!==id)throw Error('Mismatched Ashby posting ID');
    if(raw.isListed!==undefined&&typeof raw.isListed!=='boolean')throw Error('Invalid isListed');if(raw.isListed===false)return null;
    const secondary=raw.secondaryLocations??[];if(!Array.isArray(secondary)||secondary.length>1000)throw Error('Invalid secondary locations');
    location=[...new Set([raw.location,...secondary.map(x=>x.location),countryName(raw.address?.postalAddress?.addressCountry),raw.isRemote===true?'Remote':''].filter(Boolean))].join(' · ');
    url=`https://jobs.ashbyhq.com/${source.board}/${id}`;published=raw.publishedAt;
  }else throw Error('Unsupported provider');
  if(typeof location!=='string'||location.length>20000)throw Error('Invalid job location');
  return {provider:source.provider,source_id:source.id,source_job_id:id,employer:source.employer,title:text(title,300),location:text(location,1500),description:text(description),url,source_updated_at:iso(updated),published_at:iso(published),compensation:{status:'unknown',reason:'Not inferred from prose; review employer compensation terms'},provenance:'untrusted-external',fit_verified:false};
}

function engineeringTitle(title) {
  return /\b(?:software|full[ -]?stack|front[ -]?end|back[ -]?end|wordpress|woocommerce|web (?:application|developer)|(?:AI|automation|integration) (?:software )?(?:engineer|developer))\b/i.test(title)
    && !/\b(?:recruiter|recruiting|account executive|sales|manager|director|vice president|vp)\b/i.test(title);
}
function evaluate(job,geo=geography.classify(job)) {
  const unknowns=['Mandatory requirements and evidence of experience require review','Compensation and employment type require review','Current work authorization must be checked before application answers',...geo.unknowns];
  if(!engineeringTitle(job.title))return {status:'excluded',priority:0,reasons:['Outside engineering search'],unknowns:[]};
  const title=job.title.toLowerCase(),content=(title+' '+job.description).toLowerCase(),signals=['react','next.js','typescript','javascript','node.js','nestjs','python','fastapi','postgresql','wordpress','woocommerce'].filter(t=>content.includes(t));
  let priority=geo.eligible_for_primary?30:1;
  if(/wordpress|woocommerce/i.test(title))priority+=55;else if(/web developer|web application/i.test(title))priority+=30;else if(/front.?end|full.?stack/i.test(title))priority+=22;else if(/automation|integration/i.test(title))priority+=16;
  if(/\b(?:junior|entry.level|early.career)\b|\bengineer i\b(?!i)/i.test(title))priority+=30;
  const paidMinimum=job.description.match(/\b([3-9]|1\d)\+?\s*(?:years?|yrs?).{0,60}\b(?:professional|commercial|industry)\b/i)||job.description.match(/\b(?:professional|commercial|industry)\b.{0,60}\b([3-9]|1\d)\+?\s*(?:years?|yrs?)/i);if(paidMinimum){priority-=Math.min(40,Number(paidMinimum[1])*5);unknowns.push('Explicit paid/professional tenure needs separate confirmation; overall personal-project years do not satisfy it');}
  if(/\b(?:senior|sr\.?)\b/i.test(title))priority-=20;if(/\b(?:staff|principal|lead)\b/i.test(title))priority-=40;if(/intern|new grad|new graduate/i.test(title))priority-=50;
  if(/senior|sr\.?|staff|principal|lead/i.test(title))unknowns.push('Seniority requirements need evidence; personal tenure is not professional tenure');
  return {status:geo.eligible_for_primary?'consider':geo.bucket==='outside_scope'?'excluded':'needs_review',priority:Math.max(0,priority+Math.min(signals.length,8)),reasons:[...geo.reasons,...(signals.length?['Text mentions: '+signals.join(', ')]:[])],unknowns};
}
async function download(source, config, fetcher=fetch, budget=null) {
  const seen=new Set(),jobs=[],evidence=[];let bytes=0,total=0;
  const maxPages=config.max_pages_per_source??30,pageSize=100;
  for(let page=0;page<maxPages;page++){
    if(budget&&(budget.requests>=budget.maxRequests||Date.now()>=budget.deadline))throw Error('Collection request/time budget exceeded');
    if(budget)budget.requests++;
    const url=sourceUrl(source,page*pageSize,pageSize),timeout=Math.min(config.request_timeout_ms,budget?Math.max(1,budget.deadline-Date.now()):config.request_timeout_ms);
    const response=await fetcher(url,{method:'GET',redirect:'error',headers:{Accept:'application/json'},signal:AbortSignal.timeout(timeout)});
    if(!response.ok)throw Error('Source HTTP '+response.status);
    if(!/application\/json/i.test(response.headers.get('content-type')||''))throw Error('Expected JSON source');
    if(Number(response.headers.get('content-length'))>config.max_response_bytes-bytes)throw Error('Source exceeds byte limit');
    const chunks=[];let pageBytes=0;
    try{for await(const chunk of response.body){pageBytes+=chunk.length;bytes+=chunk.length;if(bytes>config.max_response_bytes)throw Error('Source exceeds byte limit');chunks.push(chunk);}}
    catch(e){await response.body?.cancel().catch(()=>{});throw e;}
    const buffer=Buffer.concat(chunks),data=JSON.parse(buffer.toString('utf8'));
    let records;
    if(source.provider==='greenhouse'){
      if(!Array.isArray(data.jobs)||!data.meta||data.meta.total!==data.jobs.length)throw Error('Incomplete or oversized board snapshot');records=data.jobs;
    }else if(source.provider==='ashby'){
      if(data.apiVersion!=='1'||!Array.isArray(data.jobs))throw Error('Incomplete or unsupported Ashby snapshot');records=data.jobs;
    }else {if(!Array.isArray(data)||data.length>pageSize)throw Error('Invalid Lever page');records=data;}
    total+=records.length;if(total>config.max_jobs_per_source)throw Error('Incomplete or oversized board snapshot');
    for(const raw of records){const job=normalize(source,raw);if(job){if(seen.has(job.source_job_id))throw Error('Duplicate source ID; unstable pagination');seen.add(job.source_job_id);jobs.push(job);}}
    evidence.push({url,http_status:response.status,bytes:pageBytes,count:records.length,sha256:crypto.createHash('sha256').update(buffer).digest('hex')});
    if(source.provider!=='lever'||records.length<pageSize)return {jobs,bytes,total,complete:true,requests:evidence.length,endpoint_evidence:evidence};
  }
  throw Error('Incomplete snapshot: pagination limit reached');
}

function applySnapshot(db,source,snapshot,at) {
  if(snapshot.complete!==true)throw Error('Complete snapshot confirmation required before changing availability');
  if(!Array.isArray(snapshot.jobs)||!Number.isFinite(Date.parse(at)))throw Error('Invalid snapshot jobs or collection time');
  const ids=new Set();
  for(const job of snapshot.jobs){
    if(!job||job.source_id!==source.id||job.provider!==source.provider||typeof job.source_job_id!=='string'||!job.source_job_id||ids.has(job.source_job_id))throw Error('Invalid, foreign or duplicate snapshot record');
    requiredString(job.title,'title',1000);requiredString(job.description,'description');
    ids.add(job.source_job_id);
  }
  const result={source_id:source.id,provider:source.provider,board:source.board,employer:source.employer,status:'ok',complete:snapshot.complete!==false,requests:snapshot.requests??1,total:snapshot.total,engineering:0,inserted:0,updated:0,unchanged:0,missing:0,bytes:snapshot.bytes};
  db.exec('BEGIN IMMEDIATE');
  try {
    const seen=new Set();
    for (const job of snapshot.jobs.filter(j=>engineeringTitle(j.title))) {
      result.engineering++;const key=source.id+':'+job.source_job_id;seen.add(key);
      const hash=digest(job),old=db.prepare('SELECT content_hash,opportunity_id,availability FROM career_discovery_jobs WHERE job_key=?').get(key);
      const geo=geography.classify(job),body={...job,evaluation:evaluate(job,geo),geography:geo};
      if (!old) { db.prepare('INSERT INTO career_discovery_jobs VALUES(?,?,?,?,?,?,?,?,?)').run(key,source.id,job.source_job_id,hash,at,at,'listed',JSON.stringify(body),null); result.inserted++; }
      else { db.prepare('UPDATE career_discovery_jobs SET content_hash=?,last_seen_at=?,availability=?,body=? WHERE job_key=?').run(hash,at,'listed',JSON.stringify(body),key);result[hash===old.content_hash?'unchanged':'updated']++;
        if(old.opportunity_id && (hash!==old.content_hash || old.availability!=='listed')) invalidateOpportunity(db,old.opportunity_id,'Source changed; reassessment required');
      }
    }
    for (const row of db.prepare("SELECT job_key,opportunity_id FROM career_discovery_jobs WHERE source_id=? AND availability='listed'").all(source.id)) {
      if (!seen.has(row.job_key)) {
        const stillPublished=snapshot.jobs.some(j=>source.id+':'+j.source_job_id===row.job_key);
        db.prepare('UPDATE career_discovery_jobs SET availability=? WHERE job_key=?').run(stillPublished?'outside_search_scope':'not_in_latest_snapshot',row.job_key);
        if(stillPublished)result.outside_search_scope=(result.outside_search_scope||0)+1;else result.missing++;
        if(row.opportunity_id)invalidateOpportunity(db,row.opportunity_id,stillPublished?'Published role outside current engineering search scope':'Not in latest complete snapshot; closure unconfirmed');
      }
    }
    db.prepare('INSERT INTO career_discovery_sources VALUES(?,?) ON CONFLICT(source_id) DO UPDATE SET body=excluded.body').run(source.id,JSON.stringify({...source,...result,last_attempt_at:at,last_success_at:at,error:null}));
    db.exec('COMMIT');return result;
  } catch(e){db.exec('ROLLBACK');throw e;}
}
function invalidateOpportunity(db,id,reason) {
  const row=db.prepare('SELECT body FROM acq_career WHERE id=?').get(id);if(!row)return;
  const body=JSON.parse(row.body);body.source_state='agent-observed-unverified';body.valid_until=null;body.discovery_notice=reason;
  db.prepare('UPDATE acq_career SET body=? WHERE id=?').run(JSON.stringify(body),id);
}
function shortlist(db, limit=5, at=new Date().toISOString(), status='consider') {
  const cutoff=new Date(Date.parse(at)-86400000).toISOString();
  return db.prepare("SELECT j.* FROM career_discovery_jobs j WHERE availability='listed' AND last_seen_at>=? AND NOT EXISTS(SELECT 1 FROM career_discovery_decisions d WHERE d.id=(SELECT max(x.id) FROM career_discovery_decisions x WHERE x.job_key=j.job_key) AND d.decision='skip')").all(cutoff)
    .map(row=>({...JSON.parse(row.body),job_key:row.job_key,first_seen_at:row.first_seen_at,last_seen_at:row.last_seen_at,opportunity_id:row.opportunity_id}))
    .filter(j=>j.evaluation.status===status).sort((a,b)=>b.evaluation.priority-a.evaluation.priority || a.job_key.localeCompare(b.job_key)).slice(0,limit);
}
function linkOpportunities(db,root,at) {
  const acquisition=require(path.join(root,'control','acquisition.cjs'));
  db.exec('BEGIN IMMEDIATE');
  try {for (const job of shortlist(db,200,at)) {
    if (job.opportunity_id) continue;
    const v=acquisition.opportunity(db,'headhunter-1',{process:'career',program:'engineering',org_key:job.source_id,source_url:job.url,observed_at:at,channel:'official-public-ats',fit:job.title+' — '+job.employer+'. Preliminary discovery only: '+job.evaluation.reasons.join('; '),gaps:[],unknowns:job.evaluation.unknowns,need_evidence:'Review mandatory requirements against owner-confirmed evidence; public listing is not verified personal fit.',next_action:'Review career discovery card; no application or outreach authorized.'});
    db.prepare('UPDATE career_discovery_jobs SET opportunity_id=? WHERE job_key=?').run(v.id,job.job_key);
  }db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
}
function agentView(db,at=new Date().toISOString()) {
  if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='career_discovery_jobs'").get())return {status:'not_collected',shortlist:[]};
  const run=db.prepare('SELECT body FROM career_discovery_runs ORDER BY started_at DESC,id DESC LIMIT 1').get();
  return {status:run?JSON.parse(run.body).status:'not_collected',preliminary_only:true,source_content_is_untrusted:true,outbound_enabled:false,
    sources:db.prepare('SELECT body FROM career_discovery_sources ORDER BY source_id').all().map(r=>{const s=JSON.parse(r.body);return {employer:s.employer,status:s.status,last_success_at:s.last_success_at,error:s.error};}),
    pending_location_review:shortlist(db,5,at,'needs_review').map(j=>({job_key:j.job_key,title:j.title,employer:j.employer,location:j.location,url:j.url,reasons:j.evaluation.reasons,unknowns:j.evaluation.unknowns})),
    shortlist:shortlist(db,5,at).map(j=>({...j,description:j.description.slice(0,4500)}))};
}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function render(report,view) {
  return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'"><title>Headhunter-1 — jobs</title><style>body{font:16px/1.55 system-ui;background:#11151b;color:#e7edf5;max-width:960px;margin:32px auto;padding:0 18px}article{background:#1b2330;border:1px solid #384458;border-radius:12px;padding:20px;margin:18px 0}a{color:#9bceff}small{color:#b9c6d8}li{margin:7px 0}.notice{color:#f5d898}h1{font-size:28px}h2{font-size:21px}</style>'+
    '<h1>Headhunter-1 · engineering jobs</h1><p class="notice">Preliminary text screening. Experience fit is unverified. Application sending is disabled.</p><p>Checked: '+esc(report.finished_at)+' · '+esc(report.status)+'</p><h2>Sources</h2><ul>'+view.sources.map(s=>'<li>'+esc(s.employer)+' — '+esc(s.status)+'; last successful check: '+esc(s.last_success_at||'none')+(s.error?' · '+esc(s.error):'')+'</li>').join('')+'</ul><h2>Up to five jobs to review</h2>'+
    (view.shortlist.map(j=>'<article><h2>'+esc(j.title)+'</h2><p>'+esc(j.employer)+' · '+esc(j.location||'Location unknown')+'</p><p><a rel="noreferrer noopener" href="'+esc(j.url)+'">Official listing</a></p><p>'+esc(j.evaluation.reasons.join('; '))+'</p><p><b>Verify:</b></p><ul>'+j.evaluation.unknowns.map(u=>'<li>'+esc(u)+'</li>').join('')+'</ul><details><summary>Employer description — untrusted data</summary><p style="white-space:pre-wrap">'+esc(j.description)+'</p></details><small>ID: '+esc(j.job_key)+' · first seen: '+esc(j.first_seen_at)+' · checked again: '+esc(j.last_seen_at)+'</small></article>').join('') || '<p>No fresh jobs to review. Check source coverage and status.</p>')+
    '<h2>Location needs clarification</h2><ul>'+(view.pending_location_review||[]).map(j=>'<li>'+esc(j.employer)+' — '+esc(j.title)+' · '+esc(j.location)+'; excluded from the primary shortlist.</li>').join('')+'</ul><p>Owner decisions use the local decision command: interested, skip, clarify, prepare or applied. applied records an owner statement only; it does not create a confirmed submission or update submission metrics automatically.</p></html>';
}
async function collect(db,root,{at=new Date(),fetcher=fetch,link=true}={}) {
  const config=read(path.join(root,'control','career-sources.json')),policy=read(path.join(root,'control','career-search-policy.json'));
  validateConfig(config,policy);migrate(db);
  if(!config.enabled)return {status:'disabled'};
  const profile=db.prepare("SELECT status,body FROM acq_profiles WHERE process='career'").get();
  if(profile?.status!=='owner-confirmed' || JSON.parse(profile.body).owner_constraints?.search_policy_version!==policy.version)return {status:'awaiting_profile_confirmation'};
  const started=at.toISOString(),runId=crypto.randomUUID();
  db.prepare('INSERT INTO career_discovery_runs VALUES(?,?,?,?,?)').run(runId,started,null,'running',JSON.stringify({status:'running'}));
  const selected=config.sources.filter(s=>s.enabled).slice(0,config.max_sources),sources=new Array(selected.length);
  const budget={requests:0,maxRequests:config.max_requests_per_run??600,deadline:Date.now()+(config.run_timeout_ms??180000)};
  let cursor=0;
  async function worker(){while(cursor<selected.length){const index=cursor++,source=selected[index];
    try{sources[index]=applySnapshot(db,source,await download(source,config,fetcher,budget),started);}
    catch(e){const old=db.prepare('SELECT body FROM career_discovery_sources WHERE source_id=?').get(source.id);const body={...source,...(old?JSON.parse(old.body):{}),status:'error',last_attempt_at:started,error:String(e.message).slice(0,240)};db.prepare('INSERT INTO career_discovery_sources VALUES(?,?) ON CONFLICT(source_id) DO UPDATE SET body=excluded.body').run(source.id,JSON.stringify(body));sources[index]={source_id:source.id,status:'error',error:body.error};}
  }}
  await Promise.all(Array.from({length:Math.min(config.concurrency??1,selected.length)},worker));

  let linkageError=null;if(link)try{linkOpportunities(db,root,started);}catch(e){linkageError=String(e.message).slice(0,240);}
  const ok=sources.filter(s=>s.status==='ok').length;
  const report={run_id:runId,started_at:started,finished_at:new Date().toISOString(),status:ok===sources.length&&ok&&!linkageError?'ok':ok?'partial':'error',policy_version:policy.version,sources,request_count:budget.requests,linkage_error:linkageError,model_calls:0,outbound_enabled:false,fit_verified:false};
  db.prepare('UPDATE career_discovery_runs SET finished_at=?,status=?,body=? WHERE id=?').run(report.finished_at,report.status,JSON.stringify(report),runId);
  const view=agentView(db,started),dir=path.join(root,'data','reports','career-discovery');
  atomic(path.join(dir,'latest.json'),JSON.stringify({...report,...view},null,2)+'\n');atomic(path.join(dir,'latest.html'),render(report,view));
  return {...report,shortlist_count:view.shortlist.length};
}
function localDay(at) {const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(at).map(x=>[x.type,x.value]));return {day:`${parts.year}-${parts.month}-${parts.day}`,hour:Number(parts.hour)};}
async function collectIfDue(db,root,options={}) {
  const config=read(path.join(root,'control','career-sources.json')),at=options.at||new Date();
  if(!config.enabled)return {status:'disabled'};const local=localDay(at);if(local.hour<config.daily_after_hour)return {status:'not_due'};
  if(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='career_discovery_runs'").get()) {
    const last=db.prepare('SELECT started_at FROM career_discovery_runs ORDER BY started_at DESC,id DESC LIMIT 1').get();
    if(last&&localDay(new Date(last.started_at)).day===local.day)return {status:'already_attempted_today'};
  }
  return collect(db,root,{...options,at});
}
function decision(db,key,value) {
  if(!['interested','skip','clarify','prepare','applied'].includes(value))throw Error('Invalid decision');
  if(!db.prepare('SELECT 1 FROM career_discovery_jobs WHERE job_key=?').get(key))throw Error('Unknown vacancy');
  db.prepare('INSERT INTO career_discovery_decisions(job_key,decision,created_at) VALUES(?,?,?)').run(key,value,new Date().toISOString());
  return {job_key:key,decision:value,recorded:true,submission_verified:false,outbound_enabled:false};
}
module.exports={text,sourceUrl,sourceIdentity,validateConfig,migrate,normalize,engineeringTitle,evaluate,download,applySnapshot,shortlist,agentView,collect,collectIfDue,decision,render};
if(require.main===module) {
  const [command='status',root=path.resolve(__dirname,'..'),key,value]=process.argv.slice(2);
  const db=new DatabaseSync(path.join(root,'data','registry.sqlite'),{readOnly:command==='status'});db.exec('PRAGMA busy_timeout=5000');
  let lockFd;const lock=path.join(root,'data','work.lock');
  (async()=>{if(['collect','collect-if-due'].includes(command)){
    try{lockFd=fs.openSync(lock,'wx');fs.writeFileSync(lockFd,JSON.stringify({pid:process.pid,created_at:new Date().toISOString(),purpose:'bounded public career collector'}));}catch(e){if(e.code==='EEXIST')return {status:'deferred',reason:'Shared dispatcher lock busy'};throw e;}
    return command==='collect'?collect(db,root):collectIfDue(db,root);
  }if(command==='status')return agentView(db);if(command==='decision')return decision(db,key,value);throw Error('Use collect, collect-if-due, status or decision [root] [job_key] [decision]');})()
    .then(result=>console.log(JSON.stringify(result,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>{db.close();if(lockFd!==undefined){fs.closeSync(lockFd);fs.unlinkSync(lock);}});
}
