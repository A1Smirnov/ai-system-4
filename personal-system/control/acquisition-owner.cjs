'use strict';
// Run manually as the owner. Never registered as an agent tool or scheduler.
const fs=require('node:fs'),r=require('./registry.cjs'),a=require('./acquisition.cjs');
if(require.main===module){const [action,file]=process.argv.slice(2);if(!action||!file){console.error('Usage: node acquisition-owner.cjs <operation> <owner-reviewed-json-file>');process.exitCode=1;}else{const db=r.open();try{console.log(JSON.stringify(a.owner(db,action,JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'')))));}catch(e){console.error(e.message);process.exitCode=1;}finally{db.close();}}}
