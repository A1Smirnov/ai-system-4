import { defineFeaturePlugin } from 'openclaw/plugin-sdk/feature-plugin';
import status from './status.cjs';
export default defineFeaturePlugin({
 contract:{pluginId:'personal-operations',events:{},operations:{status:{kind:'query',description:'Read local agent tasks, queues, schedules and process status',input:{type:'object',properties:{},additionalProperties:false},output:{type:'object',additionalProperties:true}}}},
 name:'Agent Operations',description:'Current tasks, queues, schedules and processes. Read-only.',
 setup(){return {status:async()=>status.collect()};}
});
