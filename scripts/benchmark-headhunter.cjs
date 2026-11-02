'use strict';
const fs=require('node:fs'),path=require('node:path');
async function main(){
 const runs=[];for(let i=0;i<5;i++)runs.push(await require('../tests/headhunter-scenario.cjs').run());
 const durations=runs.map(r=>r.duration_ms).sort((a,b)=>a-b);
 const result={measured_at:new Date().toISOString(),node:process.version,kind:'initial deterministic local baseline; not a real agent/ATS productivity benchmark',runs,summary:{successful:runs.filter(r=>r.success).length,total:runs.length,median_ms:durations[2],minimum_ms:durations[0],maximum_ms:durations[4],tokens:0,external_actions:0},real_outcome_metrics:{verified_employer_responses:null,interviews:null,user_time_saved:null,real_packet_correction_rate:null,reason:'Not measured by this synthetic scenario'}};
 const file=process.argv[2];if(!file)throw Error('Usage: node scripts/benchmark-headhunter.cjs <output.json>');fs.mkdirSync(path.dirname(path.resolve(file)),{recursive:true,mode:0o700});fs.writeFileSync(file,JSON.stringify(result,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(result.summary));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
