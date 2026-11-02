'use strict';
// Offline diagnostics only: no model, network, login, repair or service start.
const fs=require('node:fs'),path=require('node:path');
function configurationErrors(root){
 const errors=[],file=path.join(root,'state/openclaw.json');
 if(!fs.existsSync(file))return ['Private OpenClaw configuration missing: configure state/openclaw.json locally; see config-templates/README.md'];
 let c;try{c=JSON.parse(fs.readFileSync(file,'utf8'));}catch{return ['Private OpenClaw configuration is not valid JSON'];}
 if(!c||typeof c!=='object'||Array.isArray(c))return ['Private OpenClaw configuration must be an object'];
 if(c.gateway?.bind!=='loopback')errors.push('Manual AI-System requires a loopback Gateway');
 if(!['token','password'].includes(c.gateway?.auth?.mode))errors.push('Gateway authentication must be configured locally');
 const secret=c.gateway?.auth?.[c.gateway?.auth?.mode];
 const envSecret=c.gateway?.auth?.mode==='password'?process.env.OPENCLAW_GATEWAY_PASSWORD:process.env.OPENCLAW_GATEWAY_TOKEN;
 if((!secret||typeof secret==='string'&&!secret.trim())&&!envSecret)errors.push('Gateway credential is missing; configure it locally before startup');
 if(typeof secret==='string'&&secret.startsWith('CONFIGURE_'))errors.push('Gateway credential is an unconfigured template; set a private local credential before startup');
 if(c.cron?.enabled!==false)errors.push('Manual AI-System requires cron.enabled=false');
 if(!c.agents?.entries||typeof c.agents.entries!=='object'||Array.isArray(c.agents.entries)||!Object.keys(c.agents.entries).length)errors.push('Agent definitions are missing');
 for(const a of Object.values(c.agents?.entries||{}))if(!a||typeof a!=='object'||(a.heartbeat??c.agents?.defaults?.heartbeat)?.every!=='0m')errors.push('Manual AI-System requires valid agent definitions and disabled heartbeats');
 return [...new Set(errors)];
}
function diagnose(root=path.resolve(__dirname,'..')){
 const errors=configurationErrors(root);
 for(const file of ['app/node_modules/openclaw/package.json','personal-system/control/roles.json','personal-system/control/model-policy.json','personal-system/control/career-geography-policy.json','personal-system/control/career-geography-reference.json'])if(!fs.existsSync(path.join(root,file)))errors.push('Required local file missing: '+file);
 return {ok:!errors.length,node:process.version,platform:process.platform,errors,scope:'Offline configuration only; not authorization, service readiness, model access or a security attestation'};
}
module.exports={configurationErrors,diagnose};
if(require.main===module){const result=diagnose(process.argv[2]);console.log(JSON.stringify(result,null,2));process.exitCode=result.ok?0:1;}
