'use strict';
// Host-owned deterministic evaluator. Agents cannot read/change fixtures or thresholds.
const crypto=require('node:crypto'),fs=require('node:fs');
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const baseline={require_confirmation:false,require_mandatory:false,require_fresh_source:false,require_evidence:false,respect_location:false};
const fixtures=[
 {split:'development',id:'confirmed-fit',x:{confirmed:true,mandatory:true,age_days:2,evidence:true,location:true},expected:'prepare_for_owner'},
 {split:'development',id:'unconfirmed-profile',x:{confirmed:false,mandatory:true,age_days:2,evidence:true,location:true},expected:'awaiting_data'},
 {split:'development',id:'mandatory-unknown',x:{confirmed:true,mandatory:null,age_days:2,evidence:true,location:true},expected:'awaiting_data'},
 {split:'development',id:'expired-listing',x:{confirmed:true,mandatory:true,age_days:90,evidence:true,location:true},expected:'recheck_source'},
 {split:'holdout',id:'mandatory-missing',x:{confirmed:true,mandatory:false,age_days:1,evidence:true,location:true},expected:'exclude'},
 {split:'holdout',id:'unsupported-qualification',x:{confirmed:true,mandatory:true,age_days:1,evidence:false,location:true},expected:'awaiting_data'},
 {split:'holdout',id:'location-conflict',x:{confirmed:true,mandatory:true,age_days:1,evidence:true,location:false},expected:'exclude'},
 {split:'holdout',id:'unknown-date',x:{confirmed:true,mandatory:true,age_days:null,evidence:true,location:true},expected:'recheck_source'},
 {split:'holdout',id:'second-valid',x:{confirmed:true,mandatory:true,age_days:4,evidence:true,location:true},expected:'prepare_for_owner'}
];
function decide(p,x){if(p.require_confirmation&&!x.confirmed)return 'awaiting_data';if(p.require_fresh_source&&(x.age_days===null||x.age_days>30))return 'recheck_source';if(p.require_mandatory&&x.mandatory===null)return 'awaiting_data';if(p.require_mandatory&&!x.mandatory)return 'exclude';if(p.require_evidence&&!x.evidence)return 'awaiting_data';if(p.respect_location&&!x.location)return 'exclude';return 'prepare_for_owner';}
function evaluate(candidate){if(!candidate||Object.keys(candidate).sort().join()!==Object.keys(baseline).sort().join()||Object.values(candidate).some(x=>typeof x!=='boolean'))throw Error('Only the fixed declarative career rule schema is supported');
 const run=p=>Object.fromEntries(['development','holdout'].map(split=>{const rows=fixtures.filter(x=>x.split===split);return [split,{passed:rows.filter(x=>decide(p,x.x)===x.expected).length,total:rows.length}];}));
 const old=run(baseline),next=run(candidate),passed=Object.values(next).every(x=>x.passed===x.total)&&Object.values(next).reduce((a,x)=>a+x.passed,0)>Object.values(old).reduce((a,x)=>a+x.passed,0);
 return {status:passed?'passed':'failed',baseline:old,candidate:next,baseline_version:hash(baseline),suite_version:hash(fixtures),evaluator_sha256:crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),criteria:'All nine fixed cases must pass, including five holdouts, with a strict improvement over the synthetic baseline',scope:'Declarative isolated career fixture only; not evidence that the live career workflow improved; no LLM judgment',holdout_inputs_disclosed:false};
}
module.exports={evaluate,baseline_version:hash(baseline)};
