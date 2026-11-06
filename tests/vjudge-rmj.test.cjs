const {test}=require('node:test');const assert=require('node:assert/strict');
const {VJudgeApi}=require('../dist/providers/vjudge');
const {parseVJudgeProblem}=require('../shared/cf-problem');
test('VJudge identifiers require origin OJ and exact problem, with official links',()=>{
 assert.equal(parseVJudgeProblem('https://vjudge.net/problem/AtCoder-abc482_a').target,'AtCoder-abc482_a');
 assert.equal(parseVJudgeProblem('CodeForces-4A').oj,'CodeForces');
 const luogu = parseVJudgeProblem('https://vjudge.net/problem/%E6%B4%9B%E8%B0%B7-P1003');
 assert.equal(luogu.oj,'洛谷');assert.equal(luogu.probNum,'P1003');assert.equal(luogu.target,'洛谷-P1003');
 assert.deepEqual(parseVJudgeProblem('洛谷-P1003'),luogu);
 assert.deepEqual(parseVJudgeProblem('https://vjudge.net/problem/洛谷-P1003'),luogu);
 for(const bad of ['https://vjudge.net/problem/%ZZ-P1003','https://vjudge.net/problem/AtCoder%2Fbad-abc482_a','https://vjudge.net/problem/%252F-P1003'])assert.throws(()=>parseVJudgeProblem(bad));
 for(const x of ['abc482_a','https://evil.test/problem/AtCoder-abc482_a','https://vjudge.net/solution/73989330'])assert.throws(()=>parseVJudgeProblem(x));
});
test('VJudge RMJ uses complete solve records and validates optional submission identity',async()=>{
 const api=new VJudgeApi(),p={oj:'AtCoder',probNum:'abc482_a'};
 api.json=async path=>path.startsWith('/user/')?{acRecords:{AtCoder:['abc482_a']}}:{data:[{userName:'kfcode',oj:'AtCoder',probNum:'abc482_a',processing:false,status:'Accepted',runId:73989330,time:1793975215000,runtime:53,memory:79720}]};
 const s=await api.acceptance('kfcode',p);assert.equal(s.id,73989330);assert.equal(s.time,53);assert.equal(s.creationTimeSeconds,1793975215);
 api.json=async path=>path.startsWith('/user/')?{acRecords:{AtCoder:['abc482_a']}}:{data:[{userName:'someone',oj:'AtCoder',probNum:'abc482_a',status:'Accepted',processing:false,runId:1}]};
 assert.equal((await api.acceptance('kfcode',p)).id,null);
 api.json=async()=>({acRecords:{AtCoder:['abc380_a']}});assert.equal(await api.acceptance('kfcode',p),undefined);
 api.json=async()=>({error:'blocked'});await assert.rejects(api.acceptance('kfcode',p));
 api.json=async()=>{throw Error('network')};await assert.rejects(api.acceptance('kfcode',p),/network/);
});
