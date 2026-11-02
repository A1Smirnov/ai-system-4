'use strict';
// Tests a clean, secret-free source export. Never installs or starts an agent service.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
function command(program,args,cwd){const r=cp.spawnSync(program,args,{cwd,encoding:'utf8',maxBuffer:8*1024*1024,timeout:180000});if(r.error||r.status!==0)throw Error(program+' failed: '+(r.error?.message||r.stderr||r.stdout||'Unknown subprocess failure').slice(-5000));return r.stdout;}
function testSummary(tap){
 const counts=Object.fromEntries(['tests','pass','fail','skipped','cancelled'].map(name=>[name,Number(tap.match(new RegExp('^# '+name+' (\\d+)$','m'))?.[1]??NaN)]));
 if(!Number.isInteger(counts.tests)||counts.tests<1||counts.fail!==0||counts.cancelled!==0||counts.pass+counts.skipped!==counts.tests)throw Error('Missing or unsuccessful TAP test summary');
 return counts;
}
function main(){
 const target=fs.mkdtempSync(path.join(os.tmpdir(),'ai-clean-source-'));
 try{
  const selected=command('git',['ls-files','--cached','--others','--exclude-standard','-z'],root).split('\0').filter(Boolean);
  let copied=0;for(const f of selected){const from=path.resolve(root,f);if(!from.startsWith(root+path.sep)||!fs.existsSync(from)||!fs.lstatSync(from).isFile())continue;const to=path.join(target,f);fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to);copied++;}
  require('./prepare-config.cjs').prepare(target);
  const cache=process.env.AI_ENGINEERING_NPM_CACHE||path.join(os.tmpdir(),'ai-engineering-npm-cache');
  const online=process.argv.includes('--online');
  command('npm',['ci',...(online?[]:['--offline']),'--ignore-scripts','--no-audit','--no-fund','--cache',cache],target);
  command(process.execPath,['node_modules/typescript/bin/tsc','--noEmit'],target);
  const testFiles=['personal-system/control/ubuntu-migration-test.cjs',...fs.readdirSync(path.join(target,'tests')).filter(f=>f.endsWith('.test.cjs')).map(f=>'tests/'+f)];
  const result=command(process.execPath,['--test','--test-isolation=none','--test-reporter=tap',...testFiles],target);
  const report={checked_at:new Date().toISOString(),source_files:copied,dependencies:'root dev-only lockfile; '+(online?'online':'offline')+' npm ci --ignore-scripts',typecheck:'passed',tests:'passed',runtime:'OpenClaw installation, credentials, real browser and live providers intentionally not included; complete operational bootstrap remains unverified',test_summary:testSummary(result)};
  const file=process.argv.slice(2).find(arg=>!arg.startsWith('--'));if(file)fs.writeFileSync(path.resolve(file),JSON.stringify(report,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify(report));
 }finally{fs.rmSync(target,{recursive:true,force:true});}
}
module.exports={testSummary};
if(require.main===module)try{main();}catch(e){console.error(e.message);process.exitCode=1;}
