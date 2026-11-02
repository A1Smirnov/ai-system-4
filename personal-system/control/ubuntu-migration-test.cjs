'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const mail=require('./mail-review.cjs'),ubuntu=require('./security-ubuntu.cjs'),site=require('./security-monitor.cjs');
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'ai-migration-test-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;}
const window={from:'2026-10-19T07:00:00Z',to:'2026-10-30T07:00:00Z',owner_ref:'synthetic owner fixture'};
const message=id=>({id,subject:'Fixture',receivedDateTime:'2026-10-20T12:00:00Z',isDraft:false,body:{content:'NEVER_STORE_THIS'}});
const link='https://graph.microsoft.com/v1.0/me/messages?$skip=25';
test('mail: pages are acknowledged, replayed on timeout and checkpoint only follows final batch',async t=>{
 const root=fixture(t),g=mail.grant(root,window);let calls=0;
 const read=async(name,args)=>{assert.equal(name,'list-mail-messages');assert.equal(args.fetchAllPages,false);assert.equal(args.top,25);assert(!args.select.includes('body'));calls++;if(calls===1)return {value:Array.from({length:25},(_,i)=>message('m'+i)),'@odata.nextLink':link};assert.equal(args.skiptoken,link);return {value:[message('m24'),message('m25')]};};
 const first=await mail.next(root,'mail-1',g.id,{read});assert.equal(first.headers.length,25);assert(!JSON.stringify(first).includes('NEVER_STORE_THIS'));
 const again=await mail.next(root,'mail-1',g.id,{read});assert.equal(again.batch_id,first.batch_id);assert.equal(calls,1);assert.equal(mail.status(root,'mail-1').checkpoint,null);
 assert.equal(mail.ack(root,'mail-1',g.id,first.batch_id).checkpoint_advanced,false);
 const last=await mail.next(root,'mail-1',g.id,{read});assert.equal(last.headers.length,1);assert.equal(mail.status(root,'mail-1').checkpoint,null);
 assert.equal(mail.ack(root,'mail-1',g.id,last.batch_id).checkpoint_advanced,true);assert.equal(mail.status(root,'mail-1').checkpoint.until,new Date(window.to).toISOString());
 assert.equal(mail.ack(root,'mail-1',g.id,last.batch_id).checkpoint_advanced,false);assert.equal(mail.status(root,'mail-1').reviews[0].coverage_complete,true);
 assert(!fs.readFileSync(path.join(root,'data/mail-review/private.sqlite')).includes(Buffer.from('NEVER_STORE_THIS')));
});
test('mail: failed pages, foreign cursors and out-of-window headers never advance progress',async t=>{
 const root=fixture(t),g=mail.grant(root,window);
 await assert.rejects(mail.next(root,'mail-1',g.id,{read:async()=>{throw Error('Provider unavailable');}}));
 await assert.rejects(mail.next(root,'mail-1',g.id,{read:async()=>({value:[message('m')],'@odata.nextLink':'https://evil.example/v1.0/me/messages?$skip=25'})}));
 await assert.rejects(mail.next(root,'mail-1',g.id,{read:async()=>({value:[{...message('m'),receivedDateTime:'2026-10-01T00:00:00Z'}]})}));
 assert.equal(mail.status(root,'mail-1').reviews[0].pages,0);assert.equal(mail.status(root,'mail-1').checkpoint,null);
 await assert.rejects(mail.next(root,'elder-1',g.id,{read:async()=>({value:[]})}));assert.throws(()=>mail.status(root,'elder-1'));
});
test('mail: credential-shaped and authentication headers are withheld before persistence',()=>{
 const secret='sk-proj-'+'a'.repeat(40),h=mail.header({...message('synthetic'),subject:secret,from:{emailAddress:{name:secret,address:'fixture@example.invalid'}}},{from_at:window.from,to_at:window.to});assert(!JSON.stringify(h).includes(secret));
 assert.equal(mail.header({...message('auth'),subject:'Your verification code 123456'},{from_at:window.from,to_at:window.to}).subject,'[Authentication-related subject withheld]');
});
test('mail: cap stays partial; a later disjoint review does not jump checkpoint',async t=>{
 const root=fixture(t),g=mail.grant(root,{...window,max_headers:1});const first=await mail.next(root,'mail-1',g.id,{read:async()=>({value:[message('m')],'@odata.nextLink':link})});mail.ack(root,'mail-1',g.id,first.batch_id);
 const partial=await mail.next(root,'mail-1',g.id,{read:()=>assert.fail('must not query after cap')});assert.equal(partial.review.state,'bounded_partial');assert.equal(mail.status(root,'mail-1').checkpoint,null);
 const baseline=mail.grant(root,window),b=await mail.next(root,'mail-1',baseline.id,{read:async()=>({value:[]})});mail.ack(root,'mail-1',baseline.id,b.batch_id);
 const gap=mail.grant(root,{...window,from:'2026-10-30T08:00:00Z',to:'2026-10-30T09:00:00Z'}),b2=await mail.next(root,'mail-1',gap.id,{read:async()=>({value:[]})});assert.equal(mail.ack(root,'mail-1',gap.id,b2.batch_id).checkpoint_advanced,false);assert.equal(mail.status(root,'mail-1').checkpoint.until,new Date(window.to).toISOString());
});
test('Ubuntu: Windows source refused; stale and privilege failures remain explicit',t=>{
 const root=fixture(t);fs.mkdirSync(path.join(root,'control'));fs.writeFileSync(path.join(root,'control/security-policy.json'),JSON.stringify({host_stale_minutes:45}));fs.mkdirSync(path.join(root,'data/reports/security-ubuntu'),{recursive:true});const file=path.join(root,'data/reports/security-ubuntu/latest.json');
 fs.writeFileSync(file,JSON.stringify({platform:'win32',schema_version:1,checked_at:new Date().toISOString()}));assert.equal(ubuntu.readReport(root).host,null);
 fs.writeFileSync(file,JSON.stringify({platform:'linux',collector_id:ubuntu.COLLECTOR,schema_version:1,status:'partial',checked_at:new Date(Date.now()-3600000).toISOString(),errors:[{error:'permission_denied'}]}));const r=ubuntu.readReport(root);assert.equal(r.status,'stale');assert.equal(r.baseline_status,'observed_not_approved');assert.equal(r.errors[0].error,'permission_denied');
 assert.equal(ubuntu.errorKind({stdout:'You do not have enough privilege to read the profile set.'}),'permission_denied');
});
test('Ubuntu: encryption ancestry and listener sanitization do not expose addresses',()=>{
 assert.equal(ubuntu.encryption({blockdevices:[{type:'disk',children:[{type:'crypt',children:[{type:'lvm',fstype:'ext4',mountpoints:['/']}]}]}]}).block_encryption_observed,true);
 assert.equal(ubuntu.encryption({blockdevices:[]}).block_encryption_observed,null);
 const ports=ubuntu.listeners('tcp LISTEN 0 128 127.0.0.1:18789 0.0.0.0:*\nudp UNCONN 0 0 192.0.2.24:5353 0.0.0.0:*');assert.equal(ports[0].address_scope,'non_loopback');assert(!JSON.stringify(ports).includes('192.0.2.24'));
});
test('site source rejects symlinks, traversal and secret-shaped source',t=>{
 const root=fixture(t);fs.mkdirSync(path.join(root,'src'));fs.writeFileSync(path.join(root,'src/okay.ts'),'export const x=1;');fs.symlinkSync(path.join(root,'src/okay.ts'),path.join(root,'src/link.ts'));
 assert.throws(()=>site.safeSource(root,'src/../package.json'));assert.throws(()=>site.safeSource(root,'src/link.ts'));assert.equal(site.safeSource(root,'src/okay.ts'),path.join(root,'src/okay.ts'));
 const s=site.scrubSource('const password="abcdefghijklmnop";');assert.equal(s.findings.length,1);assert(!s.content.includes('abcdefghijklmnop'));
});
test('Headhunter: oversized first or middle form never discards fitting jobs',()=>{
 const {appendBoundedJob}=require('./career-tools.cjs'),r={jobs:[],deferred_jobs:[],candidate_claims:['fixed evidence']};assert.equal(appendBoundedJob(r,{job_key:'test:large',application_form:{text:'x'.repeat(46000)}}),false);assert.equal(appendBoundedJob(r,{job_key:'test:small'}),true);assert.equal(appendBoundedJob(r,{job_key:'test:large2',application_form:{text:'x'.repeat(46000)}}),false);assert.equal(appendBoundedJob(r,{job_key:'test:small2'}),true);assert.deepEqual(r.jobs.map(x=>x.job_key),['test:small','test:small2']);assert.equal(r.deferred_jobs.length,2);assert(JSON.stringify(r).length<=45000);
});
test('Headhunter: batch selection continues beyond oversized forms and never creates an empty objective',()=>{
 const {appendBoundedJob}=require('./career-tools.cjs'),{mergeCandidates}=require('./career-preparation-queue.cjs');
 const rows=[{job_key:'test:large',form:'x'.repeat(46000)},{job_key:'test:small'},{job_key:'test:large2',form:'x'.repeat(46000)},{job_key:'test:small2'}];
 const result=mergeCandidates(rows,keys=>{const batch={jobs:[],deferred_jobs:[]};for(const key of keys)appendBoundedJob(batch,rows.find(r=>r.job_key===key));return batch;},2);
 assert.deepEqual(result.jobs.map(x=>x.job_key),['test:small','test:small2']);assert.equal(result.deferred_jobs.length,2);
 assert.throws(()=>require('./career-worker.cjs').buildObjective([]));
});
test('Headhunter: Linux process owner uses exact entry, not a substring or unrelated node process',async t=>{
 const root=fixture(t);fs.mkdirSync(path.join(root,'control'));const file=path.join(root,'control/career-orchestrator.cjs');fs.writeFileSync(file,'process.send("ready");setInterval(()=>{},1000);');const child=cp.fork(file,[],{silent:true,execArgv:[]});t.after(()=>child.kill());await new Promise((resolve,reject)=>{child.once('message',resolve);child.once('error',reject);});const {processIdentity}=require('./career-orchestrator.cjs');assert.equal(processIdentity(root,child.pid),'owner');assert.equal(processIdentity(root+'-wrong',child.pid),'other');assert.equal(processIdentity(root,process.pid),'other');assert.equal(processIdentity(root,child.pid,'mismatched-start'),'other');await new Promise(resolve=>{child.once('exit',resolve);child.kill();});assert.equal(processIdentity(root,child.pid),'missing');
});
