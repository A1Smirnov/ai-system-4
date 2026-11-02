'use strict';
const fs=require('node:fs'),path=require('node:path');
const source=path.resolve(__dirname,'../config-templates');
function prepare(target){
 target=path.resolve(target);const mapping=[['control','personal-system/control'],['data','personal-system/data'],['state','state']];
 const files=mapping.flatMap(([from,to])=>fs.readdirSync(path.join(source,from)).filter(f=>f.endsWith('.json')).map(f=>({from:path.join(source,from,f),to:path.join(target,to,f)})));
 // Check all destinations before writing the first file. Never merge into live config.
 for(const file of files){
  if(fs.lstatSync(file.to,{throwIfNoEntry:false}))throw Error('Refusing to replace configuration: '+file.to);
  for(let directory=path.dirname(file.to);;directory=path.dirname(directory)){
   const stat=fs.lstatSync(directory,{throwIfNoEntry:false});
   if(stat&&(stat.isSymbolicLink()||!stat.isDirectory()))throw Error('Refusing unsafe configuration directory: '+directory);
   if(path.dirname(directory)===directory)break;
  }
  file.text=JSON.stringify(JSON.parse(fs.readFileSync(file.from,'utf8')),(_,value)=>typeof value==='string'?value.replaceAll('${AI_ROOT}',target.replaceAll('\\','/')):value,2)+'\n';
 }
 for(const file of files){fs.mkdirSync(path.dirname(file.to),{recursive:true,mode:0o700});fs.writeFileSync(file.to,file.text,{flag:'wx',mode:0o600});}
 return {created:files.length,target,services_started:false,outbound_enabled:false,status:'Unconfigured templates only; private configuration, authorization and sources must be supplied locally'};
}
module.exports={prepare};
if(require.main===module){try{if(!process.argv[2])throw Error('Usage: node scripts/prepare-config.cjs <new empty installation directory>');console.log(JSON.stringify(prepare(process.argv[2])));}catch(e){console.error(e.message);process.exitCode=1;}}
