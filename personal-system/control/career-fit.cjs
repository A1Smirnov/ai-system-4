'use strict';
const geo=require('./career-geography.cjs');
const BUCKETS={recommended:'Potential match',needs_review:'Needs review',exclude:'Required qualification missing'};
function evaluate(assessment,job,profile){
 const geography=geo.classify(job),input=assessment.requirements;
 if(input!==undefined&&(!Array.isArray(input)||input.length>60))throw Error('Invalid requirement matrix');
 const allowed=new Set(profile.facts.map(x=>x.id));
 const requirements=(input||[]).map(r=>{
  if(!r||typeof r.text!=='string'||!r.text.trim()||r.text.length>1200||!['required','preferred','responsibility'].includes(r.importance)||!['supported','missing','unknown'].includes(r.status)||!Array.isArray(r.claim_ids)||r.claim_ids.some(id=>!allowed.has(id)))throw Error('Invalid source-bound requirement');
  if(r.status==='supported'&&!r.claim_ids.length)throw Error('Supported requirement needs a candidate evidence reference');
  return {text:r.text,importance:r.importance,status:r.status,claim_ids:r.claim_ids};
 });
 const mandatory=requirements.filter(r=>r.importance==='required'),missing=mandatory.filter(r=>r.status==='missing'),unknown=mandatory.filter(r=>r.status==='unknown');
 const reasons=[];
 if(!mandatory.length||assessment.requirements_complete!==true)reasons.push('Required qualifications are not fully reviewed');
 if(job.evaluation?.status!=='consider'||!geography.eligible_for_primary)reasons.push('Location conditions need review');
 if(job.description_truncated||job.description?.length>16000)reasons.push('The description was not provided in full');
 if(unknown.length)reasons.push('Some required qualifications remain unknown');
 const bucket=missing.length?'exclude':reasons.length?'needs_review':'recommended';
 return {version:1,geography_policy_version:geo.policy.version,bucket,label:BUCKETS[bucket],requirements,required_supported:mandatory.filter(r=>r.status==='supported').length,required_unknown:unknown.length,required_missing:missing.length,reasons,fit_verified:false,profile_version:profile.version};
}
function draftDecision(review){
 const requirements=review?.fit?.requirements||[],mandatory=requirements.filter(r=>r.importance==='required');
 const missing=mandatory.filter(r=>r.status==='missing'),unknown=mandatory.filter(r=>r.status==='unknown');
 const reasons=[];
 if(review?.requirements_complete!==true||!mandatory.length)reasons.push('Mandatory requirements need a complete structured review');
 if(missing.length)reasons.push('Confirmed mandatory experience gap; explicit owner selection required for a stretch draft');
 return {version:1,allowed:!reasons.length,reasons,unknown_requirements:unknown.map(r=>r.text),missing_requirements:missing.map(r=>r.text),automatic_submission_candidate:!reasons.length&&review?.fit?.bucket==='recommended'};
}
module.exports={evaluate,draftDecision,BUCKETS};
