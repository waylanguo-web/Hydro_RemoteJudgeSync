const {test}=require('node:test');const assert=require('node:assert/strict');
const {parseLuoguProfile,normalizeUid}=require('../dist/providers/luogu');
const {LuoguBindingService}=require('../dist/services/luogu-binding');
test('Luogu parser validates UID, schema, and exact introduction source',()=>{
 const data={status:200,template:'user.show',data:{user:{uid:123,name:'Alice',introduction:'RMJ-test'}}};
 const html=d=>'<script id="lentille-context" type="application/json">'+JSON.stringify(d)+'</script>';
 assert.deepEqual(parseLuoguProfile(html(data),'123'),{handle:'123',displayName:'Alice',introduction:'RMJ-test'});
 assert.throws(()=>parseLuoguProfile(html(data),'456'));
 assert.throws(()=>parseLuoguProfile('<title>Challenge</title>','123'));
 assert.throws(()=>parseLuoguProfile(html({...data,status:403}),'123'));
 assert.throws(()=>parseLuoguProfile(html({...data,template:'user.setting'}),'123'));
 for(const s of ['alice','01','-1','1/../2','https://evil.test','0'])assert.throws(()=>normalizeUid(s));
});
function fixture(){let challenge,account,profile={handle:'123',introduction:'',displayName:'Alice'},now=1000,taken=false;
 const api={profile:async()=>profile};const store={account:async()=>account,owner:async()=>taken,
 save:async c=>{challenge=c;},challenge:async()=>challenge,
 consume:async c=>{if(challenge?.challengeId!==c.challengeId)return false;challenge=null;return true;},
 bind:async c=>{account={handle:c.handle};},unlink:async()=>{account=null;challenge=null;}};
 return {service:new LuoguBindingService(api,store,()=>now),api,store,profile:p=>profile=p,time:n=>now=n,taken:()=>taken=true,account:()=>account};}
test('Luogu lifecycle, wrong token, restart, replay, unlink',async()=>{
 const f=fixture(),a=await f.service.start(7,'123');
 await assert.rejects(f.service.check(7));
 const b=await f.service.start(7,'123');assert.notEqual(a.token,b.token);
 f.profile({handle:'123',introduction:a.token});await assert.rejects(f.service.check(7));
 f.profile({handle:'123',introduction:b.token});await f.service.check(7);assert.equal(f.account().handle,'123');
 await assert.rejects(f.service.check(7));await assert.rejects(f.service.start(7,'123'));
 await f.service.unlink(7);assert.equal(f.account(),null);
});
test('Luogu expiration, wrong identity, ownership conflicts and network errors fail closed',async()=>{
 const f=fixture(),c=await f.service.start(7,'123');
 f.profile({handle:'456',introduction:c.token});await assert.rejects(f.service.check(7));
 f.time(c.expiresAt+1);f.profile({handle:'123',introduction:c.token});await assert.rejects(f.service.check(7));
 const g=fixture();g.taken();await assert.rejects(g.service.start(7,'123'));
 const h=fixture();await h.service.start(7,'123');h.api.profile=async()=>{throw Error('network');};await assert.rejects(h.service.check(7));assert.equal(h.account(),undefined);
});
