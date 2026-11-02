'use strict';
// Read-only existing Outlook integration. Bodies are processed in memory, never archived here.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const hub=require('./career-hub.cjs');
const providers={linkedin:['linkedin.com'],indeed:['indeed.com','indeedemail.com'],ziprecruiter:['ziprecruiter.com','ziprecruitermail.com'],ats:['greenhouse.io','greenhouse-mail.io','ashbyhq.com','lever.co']};
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
const domainOk=(h,list)=>list.some(d=>h===d||h.endsWith('.'+d));
function safeUrl(raw){try{let u=new URL(raw.replace(/&amp;/g,'&'));if(u.hostname.endsWith('.safelinks.protection.outlook.com')&&u.searchParams.has('url'))u=new URL(u.searchParams.get('url'));if(u.protocol!=='https:'||u.username||u.password||u.port)return null;
 const allowed=['linkedin.com','indeed.com','indeedemail.com','ziprecruiter.com','ziprecruitermail.com','job-boards.greenhouse.io','boards.greenhouse.io','jobs.lever.co','jobs.eu.lever.co','jobs.ashbyhq.com'];if(!domainOk(u.hostname,allowed))return null;
 if(/unsubscribe|preferences|privacy|settings|notifications\/manage|tracking\/open|confirmemail|fraudlink|contactus|optout|\/img\/|\.(png|jpg|jpeg|gif|svg|webp|css|js)$/i.test(u.pathname))return null;
 if(domainOk(u.hostname,['linkedin.com'])){const found=u.pathname.match(/\/(?:comm\/)?jobs\/view\/(\d+)/);if(!found)return null;u=new URL('https://www.linkedin.com/jobs/view/'+found[1]+'/');}
 else if(domainOk(u.hostname,['indeed.com','indeedemail.com'])){if(!/viewjob|pagead\/clk|rc\/clk|\/jobs?\//i.test(u.pathname))return null;}
 else if(domainOk(u.hostname,['ziprecruiter.com','ziprecruitermail.com'])){if(!/\/jobs?\/|\/c\//i.test(u.pathname))return null;}
 for(const key of [...u.searchParams.keys()])if(/utm_|trk|tracking|lipi|token|sig|otp|code|auth|secret|credential/i.test(key))u.searchParams.delete(key);
 return u.href;
 }catch{return null;}}
function extract(message,provider){const address=message.from?.emailAddress?.address||'',domain=address.split('@')[1]?.toLowerCase();if(!domain||!domainOk(domain,providers[provider]))return null;
 const subject=String(message.subject||'').slice(0,300);if(/verification|security code|one.time|password|sign.in|reset|confirm.*human/i.test(subject))return null;
 const body=String(message.body?.content||message.bodyPreview||'').slice(0,300000),links=[];const seen=new Set();
 for(const m of body.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){const url=safeUrl(m[1]);if(!url||seen.has(url))continue;seen.add(url);const label=m[2].replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim().slice(0,300);if(label.length<3||/unsubscribe|privacy|manage|sign in|learn more|help center/i.test(label))continue;links.push({url,label:label||subject,source:'mail-notification; employer verification pending'});if(links.length>=30)break;}
 // Existing Outlook server deliberately returns text bodies; links must also be extracted there.
 if(!links.length)for(const match of body.matchAll(/https:\/\/[^\s<>"\[\]]+/gi)){const raw=match[0].replace(/[),.;]+$/,''),url=safeUrl(raw);if(!url||seen.has(url))continue;seen.add(url);const before=body.slice(Math.max(0,match.index-180),match.index).split(/\r?\n/).map(x=>x.trim()).filter(Boolean).pop();links.push({url,label:(before||subject).slice(0,300),source:'mail-notification; employer verification pending'});if(links.length>=30)break;}
 const job_titles=[...new Set(body.replace(/<[^>]*>/g,'\n').split(/\r?\n/).map(line=>line.replace(/\[[^\]]*\]\([^)]*\)/g,'').replace(/[*#]/g,'').trim()).filter(line=>line.length>=8&&line.length<=180&&!/https?:|unsubscribe|privacy/i.test(line)&&/\b(?:software|full.?stack|front.?end|back.?end|wordpress|woocommerce|web developer|automation engineer)\b/i.test(line)))].slice(0,20);
 const plain=body.replace(/<[^>]*>/g,' ').replace(/\s+/g,' '),text=subject+' '+plain;
 const classification=/interview|schedule.*(?:call|meeting)|availability.*(?:call|interview)/i.test(text)?'possible_interview':/not (?:be )?moving forward|other candidates|not selected|unable to offer|unfortunately/i.test(text)?'possible_rejection':/thank you for applying|application.*received|received.*application/i.test(text)?'application_receipt':'job_alert';
 return {extractor_version:3,provider,sender_domain:domain,subject,received_at:message.receivedDateTime,classification,classification_verified:false,job_titles,links,web_url:typeof message.webLink==='string'&&/^https:\/\/(outlook\.live\.com|outlook\.office\.com)\//.test(message.webLink)?message.webLink:null,matching:'requires evidence; no automatic outcome mutation',raw_body_stored:false};
}
function unwrap(result){if(result.isError){const diagnostic=(result.content||[]).filter(x=>x.type==='text').map(x=>x.text).join(' '),error=Error(diagnostic.includes('ErrorExecuteSearchStaleData')?'Outlook search cursor expired; restart the bounded query':'Outlook MCP returned an error');if(diagnostic.includes('ErrorExecuteSearchStaleData'))error.code='stale_cursor';throw error;}if(result.structuredContent)return result.structuredContent;for(const c of result.content||[])if(c.type==='text'){try{return JSON.parse(c.text);}catch{}}throw Error('Unrecognized Outlook result');}
const match=require('./career-mail-match.cjs').match;
async function connect(base){const sdk=base+'/integrations/outlook/node_modules/@modelcontextprotocol/sdk/dist/cjs',{Client}=require(sdk+'/client/index.js'),{StdioClientTransport}=require(sdk+'/client/stdio.js');
 const config=JSON.parse(fs.readFileSync(base+'/state/openclaw.json')).mcp.servers.outlook_mail;if(!config?.args?.includes('--read-only')||!config.args.includes('Mail.Read'))throw Error('Existing read-only Mail.Read integration required');
 const transport=new StdioClientTransport({command:config.command,args:config.args,cwd:config.cwd,env:{...process.env,...config.env},stderr:'pipe'});const client=new Client({name:'career-mail-readonly',version:'1.0'});transport.stderr?.on('data',()=>{});await client.connect(transport);
 return {call:async(name,args)=>{if(!['list-mail-messages','get-mail-message'].includes(name))throw Error('Read-only operation required');return unwrap(await client.callTool({name,arguments:args},undefined,{timeout:45000}));},close:()=>client.close()};}
function valueOf(data){if(Array.isArray(data.value))return data;if(Array.isArray(data.data?.value))return data.data;if(Array.isArray(data.response?.value))return data.response;if(Array.isArray(data.data))return {value:data.data};throw Error('Missing message list');}
async function scan(db,root,{adapter,providersOnly=Object.keys(providers),maxPages=2,maxBodies=30}={}){const report={checked_at:new Date().toISOString(),status:'ok',read_only:true,raw_bodies_stored:false,model_calls:0,providers:[],inserted:0,leads:0};let own=false;
 try{if(!adapter){adapter=await connect(path.resolve(root,'..'));own=true;}let bodies=0;
 for(const provider of providersOnly){if(!providers[provider])throw Error('Unknown mail provider');const saved=db.prepare('SELECT body FROM career_mail_checkpoints WHERE provider=?').get(provider),cursor=saved?JSON.parse(saved.body):{};
 const since=cursor.since||new Date(Date.now()-60*86400000).toISOString().slice(0,10),search=cursor.search||'"('+providers[provider].map(d=>'from:'+d).join(' OR ')+') AND received>='+since+'"';let next=cursor.next||null,finished=false;
 const result={provider,pages:0,seen:0,inserted:0,links:0,truncated:false};let cursorRestarted=false;
 try{bodies=0;for(let page=0;page<maxPages;page++){const args={search,top:25,select:['id','subject','from','receivedDateTime','bodyPreview','webLink','conversationId'],...(next?{skiptoken:next}:{})};let data;try{data=valueOf(await adapter.call('list-mail-messages',args));}catch(e){if(e.code==='stale_cursor'&&next&&!cursorRestarted){next=null;cursorRestarted=true;result.cursor_restarted=true;page--;continue;}throw e;}result.pages++;let stoppedForBudget=false;
 for(const message of data.value){result.seen++;const id=digest(provider+':'+message.id);if(db.prepare('SELECT 1 FROM career_mail_events WHERE id=?').get(id))continue;
 let minimal=extract(message,provider);if(!minimal)continue;if(bodies>=maxBodies){stoppedForBudget=true;break;}
 const full=await adapter.call('get-mail-message',{messageId:message.id,select:['id','subject','from','receivedDateTime','body','webLink','conversationId']});bodies++;const payload=full.data||full.response||full;minimal=extract({...message,...payload},provider);if(!minimal)continue;
 db.prepare('INSERT OR IGNORE INTO career_mail_events VALUES(?,?,?,?)').run(id,provider,message.receivedDateTime,JSON.stringify({...minimal,...match(db,minimal),message_ref:message.id,conversation_ref:message.conversationId||null}));result.inserted++;result.links+=minimal.links.length;
 }
 if(stoppedForBudget){result.truncated=true;break;}
 next=data['@odata.nextLink']||null;if(!next){finished=true;break;}
 }
 result.truncated=result.truncated||!!next||!finished;
 const checkpoint=finished?{since:new Date(Date.now()-86400000).toISOString().slice(0,10),last_complete_at:report.checked_at}:{since,search,next,last_complete_at:cursor.last_complete_at||null};db.prepare('INSERT INTO career_mail_checkpoints VALUES(?,?) ON CONFLICT(provider) DO UPDATE SET body=excluded.body').run(provider,JSON.stringify(checkpoint));
 }catch(e){result.status='error';result.reason=String(e.message).slice(0,160);report.status='partial';}
 report.providers.push(result);report.inserted+=result.inserted;report.leads+=result.links;
 }
 }catch(e){report.status='awaiting_access';report.reason=String(e.message).slice(0,180);}finally{if(own&&adapter)await adapter.close();}
 db.prepare('INSERT INTO career_hub_runs VALUES(?,?,?,?,?)').run(crypto.randomUUID(),'mail',report.status,JSON.stringify(report),new Date().toISOString());return report;
}
module.exports={providers,safeUrl,extract,unwrap,connect,scan,match};
if(require.main===module){const root=process.argv[2]||path.resolve(__dirname,'..'),db=hub.open(root);scan(db,root).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.close());}
