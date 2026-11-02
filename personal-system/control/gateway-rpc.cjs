'use strict';
const cp=require('node:child_process');
const BASE=require('node:path').resolve(__dirname,'../..');
const env={...process.env,OPENCLAW_HOME:BASE,OPENCLAW_STATE_DIR:BASE+'/state',OPENCLAW_CONFIG_PATH:BASE+'/state/openclaw.json'};
function failure(err,out,stderr,started=Date.now()){const message=(stderr||out||(err.killed?'Gateway CLI execution deadline exceeded':err.code?'Gateway CLI failed ('+err.code+')':err.message)).slice(0,2000),e=Error(message);e.diagnostic={phase:'gateway_cli',code:err.code??null,signal:err.signal??null,killed:!!err.killed,duration_ms:Date.now()-started};return e;}
function command(args,ms=30000){const started=Date.now();return new Promise((resolve,reject)=>cp.execFile(process.execPath,[BASE+'/app/node_modules/openclaw/openclaw.mjs',...args],{env,timeout:ms,windowsHide:true,maxBuffer:4*1024*1024},(err,out,stderr)=>{try{if(err)throw failure(err,out,stderr,started);const j=JSON.parse(out.trim().replace(/^\uFEFF/,''));if(j.ok===false)throw Error(JSON.stringify(j.error));resolve(j);}catch(e){reject(e);}}));}
function call(method,params={},ms=30000,final=false){return require('./gateway-sdk.cjs').call(method,params,ms,final);}
module.exports={BASE,env,command,call,failure};
