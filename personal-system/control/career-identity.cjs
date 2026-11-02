'use strict';
const timeBoundary=require('./time-boundary.cjs');
/** @typedef {import('node:sqlite').DatabaseSync} Database */
/** @typedef {{groups:Map<string,string[]>,byKey:Map<string,string>}} IdentityIndex */
/** @typedef {{allowPacket?:string|null,cached?:IdentityIndex}} PriorOptions */
/** @param {string} url @returns {string|null} */
function canonical(url){try{const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||u.port)return null;const p=u.pathname.split('/').filter(Boolean).map(decodeURIComponent);if(['job-boards.greenhouse.io','boards.greenhouse.io'].includes(u.hostname)&&p.length>=3&&p[1]==='jobs'&&/^\d+$/.test(p[2]))return 'greenhouse:'+p[0].toLowerCase()+':'+p[2];if(['jobs.lever.co','jobs.eu.lever.co'].includes(u.hostname)&&p.length>=2)return 'lever:'+u.hostname+':'+p[0].toLowerCase()+':'+p[1].toLowerCase();if(u.hostname==='jobs.ashbyhq.com'&&p.length>=2)return 'ashby:'+p[0].toLowerCase()+':'+p[1].toLowerCase();return null;}catch{return null;}}
/** @param {Database} db @returns {IdentityIndex} */
function index(db){const rows=db.prepare('SELECT job_key,body FROM career_discovery_jobs').all(),groups=/** @type {Map<string,string[]>} */ (new Map()),byKey=/** @type {Map<string,string>} */ (new Map());for(const r of rows){if(typeof r.body!=='string'||typeof r.job_key!=='string')throw Error('Invalid stored job identity');const parsed=JSON.parse(r.body);if(typeof parsed?.url!=='string')throw Error('Invalid stored job URL');const id=canonical(parsed.url)||'record:'+r.job_key;byKey.set(r.job_key,id);const members=groups.get(id)||[];members.push(r.job_key);groups.set(id,members);}return {groups,byKey};}
/** @param {Database} db @param {string} key @param {IdentityIndex} [cached] */
function describe(db,key,cached=index(db)){const id=cached.byKey.get(key);const aliases=id?cached.groups.get(id):undefined;if(!id||!aliases?.length)throw Error('Unknown vacancy');return {canonical_id:id,aliases,scope:'Exact official ATS identity only; reposts with different IDs are not automatically merged'};}
/** @param {Database} db @param {string} key @param {PriorOptions} [options] */
function prior(db,key,{allowPacket=null,cached}={}){const group=describe(db,key,cached),slots=group.aliases.map(()=>'?').join(',');const submitted=db.prepare("SELECT job_key FROM career_activity WHERE kind='stage.submitted' AND job_key IN ("+slots+') LIMIT 1').get(...group.aliases);const skipped=db.prepare("SELECT job_key FROM career_pipeline WHERE stage='skip' AND job_key IN ("+slots+') LIMIT 1').get(...group.aliases);const attempt=db.prepare('SELECT a.packet,a.state,p.job_key FROM career_web_attempts a JOIN career_web_packets p ON p.id=a.packet WHERE p.job_key IN ('+slots+') AND (? IS NULL OR a.packet<>?) LIMIT 1').get(...group.aliases,allowPacket,allowPacket);return {...group,submitted:submitted||null,attempt:attempt||null,skipped:skipped||null};}
/** @param {Database} db @param {string} key @param {PriorOptions} [options] */
function assertAvailable(db,key,options){const state=prior(db,key,options);if(state.submitted)throw Error('Confirmed prior application for this official vacancy; duplicate blocked');if(state.attempt)throw Error('Attempt exists for this official vacancy; resolve outcome, never automatically resubmit');if(state.skipped&&db.prepare('SELECT stage FROM career_pipeline WHERE job_key=?').get(key)?.stage!=='qualified')throw Error('Owner excluded an alias of this vacancy; explicitly select it again');return state;}
/**
 * A second source ID must not create another automatic draft for the same ATS posting.
 * Stale/superseded packets do not reserve that identity forever.
 * @param {Database} db @param {string} key @param {string} profileVersion @param {IdentityIndex} [cached]
 */
function currentDraftAlias(db,key,profileVersion,cached){
 const aliases=describe(db,key,cached).aliases.filter(alias=>alias!==key);
 if(!aliases.length)return null;
 const slots=aliases.map(()=>'?').join(',');
 return db.prepare("SELECT p.id,p.job_key,j.last_seen_at FROM career_web_packets p JOIN career_discovery_jobs j ON j.job_key=p.job_key WHERE p.job_key IN ("+slots+") AND p.status IN ('prepared','approved') AND j.availability='listed' AND json_extract(p.body,'$.source_hash')=j.content_hash AND json_extract(p.body,'$.profile_version')=?").all(...aliases,profileVersion).find(row=>timeBoundary.fresh(row.last_seen_at,48*3600000))||null;
}
module.exports={canonical,index,describe,prior,assertAvailable,currentDraftAlias};
