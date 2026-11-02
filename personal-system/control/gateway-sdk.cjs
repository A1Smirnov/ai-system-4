'use strict';
const {pathToFileURL}=require('node:url');
const BASE=require('node:path').resolve(__dirname,'../..');
let client;
async function call(method,params={},ms=30000,expectFinal=false){
 const started=Date.now();
 if(typeof method!=='string'||!method.length||!Number.isInteger(ms)||ms<1)throw Error('Invalid Gateway call');
 // Match the existing local Gateway environment. No credential contents are read or logged here.
 process.env.OPENCLAW_HOME=BASE;process.env.OPENCLAW_STATE_DIR=BASE+'/state';process.env.OPENCLAW_CONFIG_PATH=BASE+'/state/openclaw.json';
 client??=import(pathToFileURL(BASE+'/app/node_modules/openclaw/dist/plugin-sdk/gateway-runtime.js').href);
 try{const sdk=await client;return await sdk.callGatewayFromCli(method,{json:true,timeout:String(ms),expectFinal},params,{sharedStateMode:'read-only',progress:false,signal:AbortSignal.timeout(ms+15000)});}
 catch(e){e.diagnostic={phase:'gateway_sdk',method,duration_ms:Date.now()-started,automatic_retry_allowed:false};throw e;}
}
module.exports={BASE,call};
