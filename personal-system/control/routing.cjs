'use strict';
const fs=require('node:fs'),path=require('node:path');
function policy(root=path.resolve(__dirname,'..')){return JSON.parse(fs.readFileSync(path.join(root,'control','model-policy.json'),'utf8'));}
function operationFor(t){if(t.operation)return t.operation;if(t.allowed_actions?.includes('classify'))return 'classify';if(t.owner==='webdev-1')return 'develop';if(t.owner==='main-1')return 'coordinate';if(t.owner==='elder-1')return 'review';return 'analyze';}
function resolve(t,p=policy()){
 const operation=operationFor(t),op=p.operations[operation];if(!op)throw Error('Unknown operation');
 if(op.tier==='tools')return {operation,tier:'tools',model:null,billing:'none',provider:null};
 const category=t.data_category||({ 'mail-1':'private_mail','headhunter-1':'resume','security-1':'security_reports','security-web-1':'security_reports','analytics-1':'site_aggregate','webdev-1':'client_material','clients-1':'client_material'}[t.owner]||'public');
 if(t.owner&&p.role_data_categories?.[t.owner]&&!p.role_data_categories[t.owner].includes(category))throw Error('Data category outside role scope');
 if(!p.data_providers[category]?.includes('openai'))throw Error('Data category/provider not authorized');
 if(p.active_auth.provider!=='openai'||p.active_auth.billing!=='existing-subscription-oauth'||p.active_auth.api_enabled||p.hybrid.paid_routes_enabled||p.fallbacks.length)throw Error('Route requires explicit billing approval; refusing hidden fallback');
 const wantsSol=['webdev-1','security-1','security-web-1','elder-1'].includes(t.owner)||t.security_significant===true||(t.escalation_reasons||[]).length>0;
 if((t.escalation_reasons||[]).some(x=>!p.escalation_reasons.includes(x)))throw Error('Unknown escalation reason');
 const tier=wantsSol?'sol':op.tier;
 if(tier==='sol'&&!p.pilot.sol_approved)throw Error('Sol route not verified in pilot');
 // Preserve the known working subscription Sol route if Luna is unavailable, with an explicit reason.
 const effective=tier==='luna'&&!p.pilot.luna_approved?'sol':tier;
 if(effective==='sol'&&!p.pilot.sol_approved)throw Error('No verified permitted model route');
 return {operation,tier:effective,requested_tier:tier,thinking:p.reasoning?.[effective]||(effective==='luna'?'low':'medium'),model:p.models[effective],provider:'openai',auth_profile:p.active_auth.profile,billing:p.active_auth.billing,data_category:category,fallbacks:[],reason:tier!==effective?'Luna not qualified; retained verified Sol subscription route':wantsSol?'Explicit evidence-based escalation':'operation policy'};
}
function validatePreliminary(task,result){
 const reasons=[];if(!result||!Array.isArray(result.evidence_refs)||!Array.isArray(result.unknowns)||!result.summary)reasons.push('schema_error');
 if(result?.unknowns?.length)reasons.push('missing_evidence');
 if(task.security_significant)reasons.push('important_security_decision');
 if(result?.contradictions?.length)reasons.push('contradiction');
 return {status:reasons.length?'requires_sol_review':'preliminary_unverified',escalation_reasons:[...new Set(reasons)],verified:false};
}
module.exports={policy,operationFor,resolve,validatePreliminary};
