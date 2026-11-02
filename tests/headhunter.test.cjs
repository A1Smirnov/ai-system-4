'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
test('ten source-bound drafts across three ATS, negative cases, rerun, no outbound authority and isolated restore',async()=>{
 const result=await require('./headhunter-scenario.cjs').run();assert.equal(result.prepared_bound_drafts,10);assert.equal(result.rerun_new_packets,0);assert.equal(result.external_actions,0);
});
