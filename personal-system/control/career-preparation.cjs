'use strict';
const fs=require('node:fs'),path=require('node:path');
function read(role,root=path.resolve(__dirname,'..')) {
 if(role!=='headhunter-1')throw Error('Career preparation is outside role scope');
 const file=path.join(root,'data','career-preparation.json');
 if(!fs.existsSync(file))return {status:'not_prepared',outbound_enabled:false};
 const raw=fs.readFileSync(file,'utf8');if(Buffer.byteLength(raw)>60000)throw Error('Career preparation evidence exceeds limit');
 const data=JSON.parse(raw);if(data.role!=='headhunter-1'||data.outbound_enabled!==false||!data.case||!Array.isArray(data.evidence))throw Error('Invalid preparation evidence');
 return data;
}
module.exports={read};
