'use strict';
const path=require('node:path');
const root=path.resolve(__dirname,'../personal-system');
const server=require('../personal-system/control/career-dashboard.cjs').start(root,18795,{readOnly:true,backgroundWorker:false});
console.log('Headhunter dashboard: http://127.0.0.1:18795/ (read-only)');
process.on('SIGTERM',()=>server.close());
process.on('SIGINT',()=>server.close());
