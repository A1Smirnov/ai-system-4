'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path'),{pathToFileURL}=require('node:url');
const READ_TOOLS=new Set(['list-mail-messages','get-mail-message','list-mail-folders','list-mail-child-folders','list-mail-folder-messages']);
function payload(result){if(result.isError)throw Error('MAIL_READ_UNAVAILABLE');let value=result.structuredContent;for(const c of result.content||[])if(c.type==='text')try{value=JSON.parse(c.text);}catch{}if(value?.error)throw Error('MAIL_READ_UNAVAILABLE');if(!value||typeof value!=='object')throw Error('MAIL_RESPONSE_INVALID');return value;}
async function connect(projectRoot){
 const server=JSON.parse(fs.readFileSync(path.join(projectRoot,'state/openclaw.json'))).mcp.servers.outlook_mail;
 if(!server.args.includes('--read-only')||server.args[server.args.indexOf('--allowed-scopes')+1]!=='Mail.Read')throw Error('Mail.Read read-only configuration required');
 const base=path.join(projectRoot,'integrations/outlook/node_modules/@modelcontextprotocol/sdk/dist/esm/client');
 const {Client}=await import(pathToFileURL(path.join(base,'index.js')));const {StdioClientTransport}=await import(pathToFileURL(path.join(base,'stdio.js')));
 const transport=new StdioClientTransport({command:server.command,args:server.args,env:{...process.env,...server.env},stderr:'pipe'});transport.stderr?.on('data',()=>{});
 const client=new Client({name:'owner-bounded-mail-review',version:'1.0.0'});
 try{await client.connect(transport,{timeout:20000});}catch{await client.close();throw Error('MAIL_CONNECTION_UNAVAILABLE');}
 return {async read(name,args){if(!READ_TOOLS.has(name))throw Error('Read-only mail tool required');const result=payload(await client.callTool({name,arguments:args},undefined,{timeout:30000}));const folder=path.join(projectRoot,'personal-system/data/reports/mail-access');fs.mkdirSync(folder,{recursive:true,mode:0o700});const file=path.join(folder,'latest.json');const temp=file+'.'+crypto.randomUUID()+'.tmp';fs.writeFileSync(temp,JSON.stringify({checked_at:new Date().toISOString(),authenticated:true,scope:'Mail.Read',check:'Actual read-only Microsoft Graph mail endpoint',source_ref:'outlook-mail:mail-read-probe'})+'\n',{mode:0o600});fs.renameSync(temp,file);return result;},close:()=>client.close()};
}
module.exports={connect,payload};
