const {test}=require('node:test');const assert=require('node:assert/strict');
const {parseProfile}=require('../dist/providers/atcoder');
const {AtCoderBindingService}=require('../dist/services/atcoder-binding');
test('profile parser checks identity and reads only affiliation',()=>{
 assert.deepEqual(parseProfile('<title>alice - AtCoder</title><tr><th>Affiliation</th><td><span>RMJ-test</span></td></tr>','alice'),{handle:'alice',affiliation:'RMJ-test'});
 assert.equal(parseProfile('<title>alice - AtCoder</title><p>RMJ-test</p>','alice').affiliation,'');
 assert.equal(parseProfile('<title>alice - AtCoder</title><tr><th>所属</th><td>RMJ-test</td></tr>','alice').affiliation,'RMJ-test');
 assert.throws(()=>parseProfile('<title>Sign In - AtCoder</title>','alice'));
 assert.throws(()=>parseProfile('<title>bob - AtCoder</title>','alice'));
});
function fixture(){let challenge,account,profile={handle:'Alice',affiliation:''},now=1000,taken=false;
 const api={profile:async()=>profile};const store={account:async()=>account,owner:async()=>taken,
 save:async c=>{challenge=c;},challenge:async()=>challenge,
 consume:async c=>{if(challenge?.challengeId!==c.challengeId)return false;challenge=null;return true;},
 bind:async c=>{account={handle:c.handle};},unlink:async()=>{account=null;challenge=null;}};
 return {service:new AtCoderBindingService(api,store,()=>now),api,store,profile:p=>profile=p,time:n=>now=n,taken:()=>taken=true,account:()=>account};}
test('AtCoder lifecycle, wrong token, restart, replay, unlink',async()=>{
 const f=fixture(),a=await f.service.start(7,'Alice');
 await assert.rejects(f.service.check(7));
 const b=await f.service.start(7,'Alice');assert.notEqual(a.token,b.token);
 f.profile({handle:'Alice',affiliation:a.token});await assert.rejects(f.service.check(7));
 f.profile({handle:'Alice',affiliation:b.token});await f.service.check(7);assert.equal(f.account().handle,'Alice');
 await assert.rejects(f.service.check(7));await assert.rejects(f.service.start(7,'Alice'));
 await f.service.unlink(7);assert.equal(f.account(),null);
});
test('AtCoder expiration, wrong identity, ownership conflicts and network errors fail closed',async()=>{
 const f=fixture(),c=await f.service.start(7,'Alice');
 f.profile({handle:'Bob',affiliation:c.token});await assert.rejects(f.service.check(7));
 f.time(c.expiresAt+1);f.profile({handle:'Alice',affiliation:c.token});await assert.rejects(f.service.check(7));
 const g=fixture();g.taken();await assert.rejects(g.service.start(7,'Alice'));
 const h=fixture();await h.service.start(7,'Alice');h.api.profile=async()=>{throw Error('network');};await assert.rejects(h.service.check(7));assert.equal(h.account(),undefined);
});
