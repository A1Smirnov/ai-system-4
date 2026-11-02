'use strict';
const fs=require('node:fs'),path=require('node:path'),r=require('./registry.cjs');
const policy=JSON.parse(fs.readFileSync(path.join(__dirname,'backup-policy.json'),'utf8'));
const report={checkedAt:new Date().toISOString(),status:'awaiting_destination',reason:policy.reason,copy_performed:false,version_deletion:false,overwrite_restore:false};
if(policy.enabled||policy.destination){report.status='awaiting_decision';report.reason='A destination needs separate source, encryption/recovery and restore verification before enabling production copies.';}
r.atomic(path.join(r.ROOT,'data','reports','backup','latest.json'),report);require('./overview.cjs').generate();console.log(JSON.stringify(report));
