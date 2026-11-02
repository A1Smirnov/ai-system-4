'use strict';
const d=require('./dispatcher-v2.cjs');module.exports=d;if(require.main===module)d.tick().then(x=>console.log(JSON.stringify(x))).catch(e=>{console.error(e.message);process.exitCode=1;});
