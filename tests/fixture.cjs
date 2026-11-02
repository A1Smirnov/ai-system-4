'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const registry=require('../personal-system/control/registry.cjs');
const discovery=require('../personal-system/control/career-discovery.cjs');
const hub=require('../personal-system/control/career-hub.cjs');
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ai-engineering-fixture-'));
 fs.mkdirSync(path.join(root,'control'));
 fs.mkdirSync(path.join(root,'data'));
 fs.writeFileSync(path.join(root,'data/career-preparation.json'),JSON.stringify({candidate:{name:'Synthetic Candidate',location:'Example city',portfolio:'https://example.invalid'},case:{answers:[]}}));
 fs.writeFileSync(path.join(root,'data/career-campaign.json'),JSON.stringify({enabled:false}));
 fs.writeFileSync(path.join(root,'control/career-market-policy.json'),JSON.stringify({enabled:false}));
 const db=registry.open(root);discovery.migrate(db);hub.migrate(db);
 const profile={facts:[{id:'fixture-js',text:'Synthetic candidate built the supplied JavaScript fixture.',source:'synthetic fixture, not owner biography'}]};
 db.prepare('INSERT INTO acq_profiles(process,version,status,body) VALUES(?,?,?,?)').run('career','fixture-v1','owner-confirmed',JSON.stringify(profile));
 const pdf=Buffer.from('%PDF-1.4\n% Synthetic header fixture; not a quality-checked or upload-ready resume.\n%%EOF');
 const metadata={title:'Synthetic test material',program:'engineering',profile_version:'fixture-v1',rendered_pdf:false};
 // Fixture tests exercise packet binding, not visual PDF quality or model-written CVs.
 const columns=db.prepare('PRAGMA table_info(acq_materials)').all().map(x=>x.name);
 const values={id:'fixture-pdf',process:'career',program:'engineering',sha256:hub.hash(pdf),body:JSON.stringify(metadata),content:pdf,created_at:new Date().toISOString()};
 const names=columns.filter(x=>Object.hasOwn(values,x));
 db.prepare('INSERT INTO acq_materials('+names.join(',')+') VALUES('+names.map(()=>'?').join(',')+')').run(...names.map(x=>values[x]));
 return {root,db,profile,close(){db.close();fs.rmSync(root,{recursive:true,force:true});}};
}
function source(i=1,provider='greenhouse'){return {id:'fixture-'+i,provider,board:'synthetic-employer-'+i,employer:'Synthetic Employer '+i};}
function raw(s,id=1,extra={}){
 if(s.provider==='greenhouse')return {id,title:'Junior Web Developer',content:'JavaScript required. Fully remote position in the United States.',location:{name:'United States, Remote'},internal_job_id:1,...extra};
 if(s.provider==='lever')return {id:'job-'+id,text:'Junior Web Developer',descriptionPlain:'JavaScript required. Fully remote position in the United States.',categories:{location:'United States, Remote'},...extra};
 return {id:'job-'+id,title:'Junior Web Developer',descriptionPlain:'JavaScript required. Fully remote position in the United States.',location:'United States, Remote',jobUrl:'https://jobs.ashbyhq.com/'+s.board+'/job-'+id,isListed:true,...extra};
}
function importJob(db,s,id=1,extra={},at=new Date().toISOString()){
 const job=discovery.normalize(s,raw(s,id,extra));
 discovery.applySnapshot(db,s,{complete:true,jobs:[job],total:1,bytes:100,requests:1},at);
 const key=s.id+':'+job.source_job_id;
 return {key,job,row:db.prepare('SELECT * FROM career_discovery_jobs WHERE job_key=?').get(key)};
}
function prepare(db,item){
 hub.assess(db,item.key,item.row.content_hash,{summary:'Synthetic requirement match, no hiring claim.',gaps:[],claim_ids:['fixture-js'],track:'frontend',requirements_complete:true,requirements:[{text:'JavaScript required',importance:'required',status:'supported',claim_ids:['fixture-js']}]});
 return hub.preparePacket(db,item.key,{automatic:true,material_id:'fixture-pdf',answers:{'Full Name':'Synthetic Candidate'},cover_letter:'Synthetic fixture only. Evidence: fixture-js.'});
}
module.exports={fixture,source,raw,importJob,prepare};
