'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./fixture.cjs');
test('English presentation retains multilingual authentication-subject protection',()=>{
 const {header}=require('../personal-system/control/mail-review.cjs');
 const scope={from_at:'2026-10-01T00:00:00Z',to_at:'2026-10-02T00:00:00Z'};
 const message={id:'synthetic-header',receivedDateTime:'2026-10-01T12:00:00Z',isDraft:false};
 for(const subject of ['Login code 123456','\u041a\u043e\u0434 \u0432\u0445\u043e\u0434\u0430 123456','\u041a\u041e\u0414 \u041f\u041e\u0414\u0422\u0412\u0415\u0420\u0416\u0414\u0415\u041d\u0418\u042f'])assert.equal(header({...message,subject},scope).subject,'[Authentication-related subject withheld]');
 assert.equal(header({...message,subject:'Synthetic interview invitation'},scope).subject,'Synthetic interview invitation');
});
test('English source notation retains multilingual secret rejection in owner feedback',t=>{
 const f=fixture();t.after(()=>f.close());
 const learning=require('../personal-system/control/learning.cjs');
 const input={kind:'observation',scope:'Synthetic language regression',source_ref:'fixture:language'};
 for(const statement of ['password=not-a-real-credential','\u043f\u0430\u0440\u043e\u043b\u044c=not-a-real-credential','\u041f\u0410\u0420\u041e\u041b\u042c=not-a-real-credential'])assert.throws(()=>learning.feedback(f.db,{...input,statement}),/Sensitive content rejected/);
 assert.equal(f.db.prepare('SELECT count(*) AS n FROM learning_sources').get().n,0);
 assert(learning.feedback(f.db,{...input,statement:'Synthetic observation without private content'}).id);
});
