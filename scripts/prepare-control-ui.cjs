'use strict';
// Keep the stock agent overview at /, retaining /agents and direct chat URLs.
// Build a supported custom UI root; never edit the installed OpenClaw package.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),source=path.join(root,'app/node_modules/openclaw/dist/control-ui');
const destination=path.join(root,'state/control-ui'),marker='"agents-home":{path:`/agents`}';
const candidates=fs.readdirSync(path.join(source,'assets')).filter(x=>/^control-ui-core-.*\.js$/.test(x)).filter(x=>fs.readFileSync(path.join(source,'assets',x),'utf8').includes(marker));
if(candidates.length!==1)throw Error('Unsupported Control UI route layout; existing UI left intact');
const file=candidates[0],original=fs.readFileSync(path.join(source,'assets',file),'utf8');
if(original.split(marker).length!==2)throw Error('Ambiguous route marker');
const stage=destination+'.stage-'+crypto.randomUUID();fs.cpSync(source,stage,{recursive:true,errorOnExist:true,force:false});
// A new asset namespace prevents old immutable browser caches from restoring the chat route.
const namespace='assets-ai-system-'+crypto.createHash('sha256').update(original+'root-overview-v1').digest('hex').slice(0,12);
fs.cpSync(path.join(stage,'assets'),path.join(stage,namespace),{recursive:true});
fs.writeFileSync(path.join(stage,namespace,file),original.replace(marker,'"agents-home":{path:`/`,aliases:[`/agents`]}'));
const index=path.join(stage,'index.html');fs.writeFileSync(index,fs.readFileSync(index,'utf8').replaceAll('./assets/','./'+namespace+'/'));
// Compressed sidecars would otherwise serve the original route map.
for(const suffix of ['.br','.gz'])fs.rmSync(path.join(stage,namespace,file+suffix),{force:true});
fs.writeFileSync(path.join(stage,'ai-system-ui.json'),JSON.stringify({version:1,source_build:fs.readFileSync(path.join(source,'index.html'),'utf8').match(/data-openclaw-control-ui-build-id="([^"]+)"/)?.[1],modified_asset:file,original_sha256:crypto.createHash('sha256').update(original).digest('hex'),change:'Stock agents-home route /; alias /agents; no redirects, auth or storage changes'})+'\n');
if(fs.existsSync(destination))fs.renameSync(destination,destination+'.before-'+Date.now());
fs.renameSync(stage,destination);console.log(JSON.stringify({root:destination,default_path:'/',component:'stock agents-home',auth_unchanged:true}));
