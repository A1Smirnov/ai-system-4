'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {prepare}=require('../scripts/prepare-config.cjs');
test('new configuration: disabled templates, private modes, clear startup block and no overwrite',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ai-config-test-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const result=prepare(root);assert.equal(result.services_started,false);assert.equal(result.outbound_enabled,false);
 const file=path.join(root,'state/openclaw.json'),before=fs.readFileSync(file);assert.equal(fs.statSync(file).mode&0o777,0o600);
 const errors=require('../scripts/diagnose-ai-system.cjs').configurationErrors(root);assert(errors.some(e=>e.includes('unconfigured template')));
 assert.throws(()=>prepare(root),/Refusing to replace/);assert.deepEqual(fs.readFileSync(file),before);
 assert.equal(JSON.parse(fs.readFileSync(path.join(root,'personal-system/data/career-campaign.json'))).enabled,false);
});
test('new configuration: missing config and symlink ancestors are refused',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ai-config-test-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 assert(require('../scripts/diagnose-ai-system.cjs').configurationErrors(root)[0].includes('missing'));
 fs.mkdirSync(path.join(root,'target'));fs.symlinkSync(path.join(root,'target'),path.join(root,'link'));
 assert.throws(()=>prepare(path.join(root,'link')),/unsafe configuration directory/);assert.deepEqual(fs.readdirSync(path.join(root,'target')),[]);
});
test('tool schemas reject malformed types, extra nested fields, oversized arrays and unrecognized types',()=>{
 const {validate}=require('../personal-system/control/tool-input.cjs');const schema={type:'object',additionalProperties:false,properties:{values:{type:'array',items:{type:'string'},minItems:1,maxItems:2,uniqueItems:true},nullable:{type:['string','null']}},required:['values']};
 validate(schema,{values:['ok'],nullable:null});
 for(const input of [[],null,{values:['x','x']},{values:['a','b','c']},{values:[1]},{values:['x'],role:'main-1'}])assert.throws(()=>validate(schema,input));
 assert.throws(()=>validate({type:'UNSUPPORTED'},{}),/Unsupported/);
 assert.throws(()=>validate({type:'string',pattern:'^admin$'},'other'),/Unsupported/);
});
test('diagnostics: malformed config and empty credential fail clearly rather than throwing or permitting startup',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ai-config-test-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));prepare(root);
 const file=path.join(root,'state/openclaw.json'),check=require('../scripts/diagnose-ai-system.cjs').configurationErrors;
 fs.writeFileSync(file,'null');assert.match(check(root)[0],/must be an object/);
 const cfg={gateway:{bind:'loopback',auth:{mode:'token',token:''}},cron:{enabled:false},agents:{entries:{example:null}}};fs.writeFileSync(file,JSON.stringify(cfg));
 const errors=check(root);assert(errors.some(e=>e.includes('credential'))||process.env.OPENCLAW_GATEWAY_TOKEN);assert(errors.some(e=>e.includes('valid agent definitions')));
});
test('clean source report requires real successful TAP counts, not just exit code zero',()=>{
 const {testSummary}=require('../scripts/verify-clean-source.cjs');
 assert.equal(testSummary('# tests 2\n# pass 2\n# fail 0\n# skipped 0\n# cancelled 0\n').tests,2);
 assert.throws(()=>testSummary('empty output'),/TAP/);
 assert.throws(()=>testSummary('# tests 2\n# pass 1\n# fail 1\n# skipped 0\n# cancelled 0\n'),/TAP/);
});
