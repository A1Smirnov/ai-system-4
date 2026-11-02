'use strict';
// Call only at dashboard startup before its browser worker exists.
function recover(db,root){const hub=require('./career-hub.cjs'),result=[];for(const row of db.prepare("SELECT q.packet,p.job_key FROM career_send_queue q JOIN career_web_packets p ON p.id=q.packet WHERE q.state='running'").all()){
 const existing=db.prepare('SELECT a.state FROM career_web_attempts a JOIN career_web_packets p ON p.id=a.packet WHERE p.job_key=?').get(row.job_key);let state,reason;
 if(existing){state='error';reason='Interrupted worker has a durable existing attempt; inspect outcome, never replay';}
 else try{const p=hub.checkedPacket(db,row.packet),g=db.prepare('SELECT * FROM career_web_grants WHERE packet=?').get(row.packet),stage=db.prepare('SELECT stage FROM career_pipeline WHERE job_key=?').get(row.job_key)?.stage;if(!g||g.revoked||g.digest!==p.digest||Date.parse(g.expires_at)<=Date.now()||stage!=='approved')throw Error('Current exact owner grant and approved stage required');state='queued';reason='Worker interrupted before durable attempt creation; no browser or submit could have started';}catch(e){state='error';reason=e.message;}
 hub.tx(db,()=>{db.prepare("UPDATE career_send_queue SET state=? WHERE packet=? AND state='running'").run(state,row.packet);hub.event(db,row.job_key,'submission.worker_recovered',{packet:row.packet,state,reason,prior_attempt_exists:!!existing,submit_replayed:false});});result.push({...row,state,reason});
 }return result;}
module.exports={recover};
