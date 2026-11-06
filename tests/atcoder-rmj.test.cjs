const {test}=require('node:test');const assert=require('node:assert/strict');
const {parseAtCoderProblem,parseRemoteProblem}=require('../shared/remote-problem');
const {AtCoderSubmissionsApi}=require('../dist/providers/atcoder-submissions');
test('AtCoder IDs and official links preserve explicit contest IDs',()=>{
 for(const input of ['abc385_b','ABC385_B','https://atcoder.jp/contests/abc385/tasks/abc385_b?lang=en'])assert.deepEqual(parseAtCoderProblem(input),{contestId:'abc385',taskId:'abc385_b'});
 assert.equal(parseRemoteProblem('atcoder','https://atcoder.jp/contests/abc043/tasks/abc022_b').target,'abc043/abc022_b');
 for(const input of ['https://evil.test/contests/abc385/tasks/abc385_b','https://atcoder.jp.evil.test/contests/abc385/tasks/abc385_b','abc385','CF4A'])assert.throws(()=>parseAtCoderProblem(input));
 assert.throws(()=>parseRemoteProblem('luogu','P1000'));
 assert.equal(parseRemoteProblem('atcoder','https://atcoder.jp/contests/tenka1-2012-qualA/tasks/tenka1_2012_qualA_4').target,'tenka1-2012-qualA/tenka1_2012_qualA_4');
});
test('AtCoder pagination overlaps the final second, matches identity/task/contest/verdict',async()=>{
 const api=new AtCoderSubmissionsApi(),calls=[];
 const row={id:1,epoch_second:100,problem_id:'abc385_b',contest_id:'abc385',user_id:'Alice',result:'WA'};
 api.page=async(h,from)=>{calls.push(from);return from===0?Array(500).fill(row):[{...row,id:2,result:'AC'}];};
 assert.equal((await api.acceptance('alice',{contestId:'abc385',taskId:'abc385_b'})).id,2);assert.deepEqual(calls,[0,100]);
 for(const patch of [{user_id:'Bob'},{problem_id:'abc385_c'},{contest_id:'abc386'},{result:'WA'}]){
 api.page=async()=>[{...row,result:'AC',...patch}];assert.equal(await api.acceptance('Alice',{contestId:'abc385',taskId:'abc385_b'}),undefined);
 }
 api.page=async()=>Array(500).fill(row);await assert.rejects(api.acceptance('Alice',{contestId:'abc385',taskId:'abc385_b'}),/时间边界/);
 api.page=async()=>{throw Error('network');};await assert.rejects(api.acceptance('Alice',{contestId:'abc385',taskId:'abc385_b'}),/network/);
});
