'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const hub=require('./career-hub.cjs'),sender=require('./career-submit.cjs');
function start(root=path.resolve(__dirname,'..'),port=18795,{readOnly=false,backgroundWorker=true}={}){const db=hub.open(root),csrf=crypto.randomBytes(24).toString('hex'),cookie=crypto.randomBytes(24).toString('hex');const address='http://127.0.0.1:'+port;const sender=backgroundWorker&&!readOnly?require('./career-browser-client.cjs').client(root):require('./career-submit.cjs');
 const files={'/':['career-dashboard.html','text/html; charset=utf-8'],'/style.css':['career-dashboard.css','text/css; charset=utf-8'],'/app.js':['career-dashboard.js','text/javascript; charset=utf-8']};
 function send(res,status,data,type='application/json; charset=utf-8'){res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"});res.end(type.startsWith('application/json')?JSON.stringify(data):data);}
 async function body(req){let text='';for await(const chunk of req){text+=chunk;if(text.length>24000)throw Error('Request too large');}return JSON.parse(text||'{}');}
 const server=http.createServer(async(req,res)=>{try{
  if(req.headers.host!=='127.0.0.1:'+port){send(res,403,{error:'Local host required'});return;}
  const url=new URL(req.url,address);if(url.pathname==='/health'){send(res,200,{ok:true,service:'career-dashboard'});return;}
  if(files[url.pathname]&&req.method==='GET'){if(url.pathname==='/')res.setHeader('Set-Cookie','career_session='+cookie+'; HttpOnly; SameSite=Strict; Path=/');const [file,type]=files[url.pathname];send(res,200,fs.readFileSync(path.join(__dirname,file)),type);return;}
  if(!req.headers.cookie?.split(';').some(x=>x.trim()==='career_session='+cookie)){send(res,403,{error:'Open the dashboard home page first'});return;}
  if(req.method==='GET'){if(url.pathname==='/api/packets')await sender.refresh?.();
   if(url.pathname==='/api/overview')send(res,200,{...hub.overview(db,root),csrf});
   else if(url.pathname==='/api/orchestration')send(res,200,require('./career-orchestrator.cjs').publicStatus(root));
   else if(url.pathname==='/api/stops')send(res,200,require('./career-stops.cjs').snapshot(db,root));
   else if(url.pathname==='/api/campaign')send(res,200,{...require('./career-campaign.cjs').status(db,root),runtime:{read_only:readOnly,browser_transport_enabled:backgroundWorker&&!readOnly}});
   else if(url.pathname==='/api/funnel')send(res,200,{rows:hub.funnel(db),definition:'Unique locally registered jobs per ATS; confirmed outcomes only; proposed mail classifications excluded'});
   else if(url.pathname==='/api/jobs')send(res,200,hub.listing(db,Object.fromEntries(url.searchParams),root));
   else if(url.pathname==='/api/job')send(res,200,hub.detail(db,url.searchParams.get('key'),root));
   else if(url.pathname==='/api/mail'){const offset=Math.max(0,Math.min(100000,Number(url.searchParams.get('offset'))||0));send(res,200,{rows:db.prepare('SELECT id,body FROM career_mail_events ORDER BY received_at DESC LIMIT 30 OFFSET ?').all(offset).map(x=>{const event={...JSON.parse(x.body),event_id:x.id};return {...event,...require('./career-mail-match.cjs').match(db,event)};})});}
   else if(url.pathname==='/api/evidence'){const file=path.join(root,'data/career-evidence.json');send(res,200,fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{projects:[]});}
   else if(url.pathname==='/api/packets'){const employerSnapshot=require('./career-employers.cjs').snapshot(db,{root});send(res,200,{rows:db.prepare("SELECT p.*,coalesce(v.stage,'discovered') AS pipeline_stage,json_extract(j.body,'$.title') AS title,json_extract(j.body,'$.employer') AS employer,json_extract(j.body,'$.geography') AS geography_json,r.body AS assessment,m.body AS material_body,a.state AS attempt_state,a.body AS attempt_body FROM career_web_packets p JOIN career_discovery_jobs j ON j.job_key=p.job_key LEFT JOIN career_pipeline v ON v.job_key=p.job_key LEFT JOIN career_web_attempts a ON a.packet=p.id LEFT JOIN career_assessments r ON r.job_key=p.job_key LEFT JOIN acq_materials m ON m.id=json_extract(p.body,'$.resume.id') ORDER BY p.created_at DESC LIMIT 100").all().map(x=>({...x,body:JSON.parse(x.body),browser_session:sender.sessionStatus(x.id),lifecycle:require('./career-lifecycle.cjs').forJob(db,x.job_key,{root,employerSnapshot}),attempt_body:x.attempt_body?JSON.parse(x.attempt_body):null,geography:x.geography_json?JSON.parse(x.geography_json):null,assessment:x.assessment?JSON.parse(x.assessment):null,resume_title:x.material_body?JSON.parse(x.material_body).title:null}))});}
   else if(url.pathname==='/api/materials'){const profile=db.prepare("SELECT version FROM acq_profiles WHERE process='career'").get(),prep=JSON.parse(fs.readFileSync(path.join(root,'data/career-preparation.json')));const c=prep.candidate;send(res,200,{materials:db.prepare("SELECT id,body,content FROM acq_materials WHERE process='career' AND program='engineering'").all().filter(x=>JSON.parse(x.body).profile_version===profile.version&&Buffer.from(x.content).subarray(0,5).equals(Buffer.from('%PDF-'))).map(x=>({id:x.id,title:JSON.parse(x.body).title})),default_answers:{'First Name':c.first_name||'','Last Name':c.last_name||'','Full Name':c.name,'Email':c.email,'Phone':c.phone,'Country':c.country||'','Location (City)':c.location||'','Website':c.portfolio,'LinkedIn Profile':c.linkedin}});}
   else if(url.pathname==='/api/material'){const material=db.prepare("SELECT content FROM acq_materials WHERE id=? AND process='career' AND program='engineering'").get(url.searchParams.get('id'));if(!material||!Buffer.from(material.content).subarray(0,5).equals(Buffer.from('%PDF-')))throw Error('Unknown PDF');send(res,200,Buffer.from(material.content),'application/pdf');}
   else if(url.pathname==='/api/screenshot'){const id=url.searchParams.get('id');if(!/^[a-f0-9-]{36}$/.test(id||'')||!db.prepare('SELECT 1 FROM career_web_packets WHERE id=?').get(id))throw Error('Unknown packet');const file=path.join(root,'data/career-private/submissions',id,'page.png');if(!fs.existsSync(file))throw Error('No browser screenshot yet');send(res,200,fs.readFileSync(file),'image/png');}
   else send(res,404,{error:'Not found'});return;
  }
  if(readOnly){send(res,403,{error:'Read-only preview; production actions disabled'});return;}
  if(req.method!=='POST'||req.headers.origin!==address||req.headers['x-career-csrf']!==csrf){send(res,403,{error:'Same-origin owner action required'});return;}
  const x=await body(req);let value;
  if(url.pathname==='/api/campaign/pause')value=require('./career-campaign.cjs').setEnabled(db,root,false);
  else if(url.pathname==='/api/decision')value=hub.ownerDecision(db,x.job_key,x.value);
  else if(url.pathname==='/api/employer/second')value=require('./career-employers.cjs').second(db,root,x);
  else if(url.pathname==='/api/employer/revoke')value=require('./career-employers.cjs').revoke(db,x.id);
  else if(url.pathname==='/api/employer/primary')value=require('./career-employers.cjs').select(db,root,x.job_key);
  else if(url.pathname==='/api/prepare')value=hub.preparePacket(db,x.job_key,x);
  else if(url.pathname==='/api/mail/link')value=require('./career-mail-match.cjs').link(db,x.event_id,x.job_key);
  else if(url.pathname==='/api/preflight')value=await require('./career-application-check.cjs').check(db,root,x.id);
  else if(url.pathname==='/api/approve')value=hub.approve(db,x.id,x.digest);
  else if(url.pathname==='/api/approve-batch')value=hub.approveBatch(db,x.packets);
  else if(url.pathname==='/api/execute')value=await sender.execute(db,root,x.id);
  else if(url.pathname==='/api/browser/show')value=await sender.show(x.id);
  else if(url.pathname==='/api/browser/check')value=await sender.observe(db,root,x.id);
  else if(url.pathname==='/api/submit')value=await sender.submit(db,root,x.id,{security_code:x.security_code});
  else {send(res,404,{error:'Not found'});return;}send(res,200,value);
 }catch(e){send(res,400,{error:String(e.message).slice(0,240)});}});
 // Browser worker owns recovery and live sessions; UI restarts preserve it.
 const worker=null;
 server.listen(port,'127.0.0.1');server.on('close',()=>{clearInterval(worker);db.close();});return server;
}
module.exports={start};if(require.main===module){const root=process.argv[2]||path.resolve(__dirname,'..');const server=start(root);console.log('Career dashboard listening on http://127.0.0.1:18795');process.on('SIGTERM',()=>server.close());}
