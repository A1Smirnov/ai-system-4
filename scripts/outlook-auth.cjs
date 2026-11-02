'use strict';
// Owner terminal helper; never exposed as an agent tool.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const mode=process.argv[2]||'verify';
if(!['login','verify'].includes(mode))throw Error('Usage: node scripts/outlook-auth.cjs [login|verify]');
const server=JSON.parse(fs.readFileSync(path.join(root,'state/openclaw.json'))).mcp.servers.outlook_mail;
const args=server.args||[];
if(!args.includes('--read-only')||args[args.indexOf('--allowed-scopes')+1]!=='Mail.Read')throw Error('Expected existing read-only Mail.Read configuration');
const env={...process.env,...server.env};
if(mode==='login'){
  console.log('Sign in to the configured Microsoft account using the instructions below. Existing Mail.Read scope is preserved.');
  const result=cp.spawnSync(server.command,[...args,'--login'],{env,stdio:'inherit',timeout:600000});
  if(result.error||result.status!==0)process.exit(1);
}
(async()=>{let client;try{client=await require('../personal-system/control/mail-transport.cjs').connect(root);const result=await client.read('list-mail-folders',{top:1,select:['id']});const success=Array.isArray(result.value);console.log(JSON.stringify({authenticated:success,check:'Configured account + Mail.Read folder access; no User.Read required',reason:success?'mail_read_verified':'invalid_response',mail_read:false,mail_sent:false}));if(!success)process.exitCode=1;}catch{console.log(JSON.stringify({authenticated:false,check:'Mail.Read folder access',reason:'login_or_mail_read_check_failed',mail_read:false,mail_sent:false}));process.exitCode=1;}finally{await client?.close();}})();
