'use strict';
// Audit maintained first-party text. Historical records and upstream packages
// are data, not translation targets. Unicode notation retains multilingual input rules.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const extensions=new Set(['.md','.cjs','.mjs','.js','.json','.html','.css','.ts','.sh','.ps1','.py','.yml','.yaml']);
const cyrillic=/[\u0400-\u04ff]/u;
function files(directory){
 if(!fs.existsSync(directory))return [];
 return fs.readdirSync(directory,{withFileTypes:true}).flatMap(item=>{
  if(item.isSymbolicLink())throw Error('Unexpected source symlink: '+path.relative(root,path.join(directory,item.name)));
  if(['node_modules','.git','__pycache__'].includes(item.name))return [];
  const file=path.join(directory,item.name);
  return item.isDirectory()?files(file):extensions.has(path.extname(file))?[file]:[];
 });
}
function check(){
 const selected=[path.join(root,'README.md'),...['docs','packaging','config-templates','scripts','tests','types','extensions/personal-operations'].flatMap(p=>files(path.join(root,p)))];
 // Working control JSON includes historical owner decisions; never rewrite it
 // to satisfy a source-language audit. Source-only distributions omit it.
 selected.push(...files(path.join(root,'personal-system/control')).filter(p=>path.extname(p)!=='.json'));
 for(const workspace of [path.join(root,'workspace'),...fs.existsSync(path.join(root,'personal-system/workspaces'))?fs.readdirSync(path.join(root,'personal-system/workspaces')).map(p=>path.join(root,'personal-system/workspaces',p)):[]]){
  if(fs.existsSync(workspace))selected.push(...fs.readdirSync(workspace).filter(n=>['AGENTS.md','IDENTITY.md','SOUL.md','USER.md'].includes(n)).map(n=>path.join(workspace,n)));
 }
 const findings=[];
 for(const file of selected)for(const [i,line]of fs.readFileSync(file,'utf8').split('\n').entries())if(cyrillic.test(line))findings.push({file:path.relative(root,file),line:i+1});
 return {checked_files:selected.length,findings,scope:'Maintained first-party source, documentation, templates and active role instructions; excludes upstream, private records and historical diaries'};
}
module.exports={check};
if(require.main===module)try{const result=check();console.log(JSON.stringify(result));if(result.findings.length)process.exitCode=1;}catch(e){console.error(e.message);process.exitCode=1;}
