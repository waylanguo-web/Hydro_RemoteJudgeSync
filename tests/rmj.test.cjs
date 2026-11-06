const {test}=require('node:test');const assert=require('node:assert/strict');const Module=require('node:module');
const {parseCFProblem}=require('../dist/services/rmj');
const {CodeforcesApi,codeforcesApi}=require('../dist/providers/codeforces');
const {atcoderSubmissionsApi}=require('../dist/providers/atcoder-submissions');
const {atcoderOfficialApi}=require('../dist/providers/atcoder-official');
test('CF target parser accepts canonical forms and rejects arbitrary hosts',()=>{
 for(const value of ['CF4A','4:A','cf 4 a','https://www.codeforces.com/contest/4/problem/A?locale=en#statement','https://codeforces.com/contest/4/problem/A','https://codeforces.com/problemset/problem/4/A'])assert.deepEqual(parseCFProblem(value),{contestId:4,index:'A'});
 for(const value of ['https://evil.test/4/A','0A','4','https://codeforces.com.evil.test/contest/4/problem/A'])assert.throws(()=>parseCFProblem(value));
});
test('CF RMJ scans older pages and distinguishes API errors from no AC',async()=>{
 const api=new CodeforcesApi();let calls=[];
 const row={id:1,verdict:'WRONG_ANSWER',problem:{contestId:4,index:'A'},author:{members:[{handle:'alice'}]}};
 api.call=async(m,p)=>{calls.push(p.from);return p.from==='1'?Array(1000).fill(row):[{...row,id:2,verdict:'OK'}];};
 assert.equal((await api.acceptance('Alice',{contestId:4,index:'A'})).id,2);assert.deepEqual(calls,['1','1001']);
 api.call=async()=>[row];assert.equal(await api.acceptance('Alice',{contestId:4,index:'A'}),undefined);
 api.call=async()=>{throw Error('network');};await assert.rejects(api.acceptance('Alice',{contestId:4,index:'A'}),/network/);
});
test('Hydro RMJ creates native records without local tasks, guards binding/CSRF/contest and leaves ordinary submissions alone',async()=>{
 const original=Module._load,oldAcceptance=codeforcesApi.acceptance,oldAtCoder=atcoderSubmissionsApi.acceptance,oldAtCoderOfficial=atcoderOfficialApi.acceptance,oldVerify=atcoderOfficialApi.verifyCredentials;const hooks={};let records=[],ends=[],incs=0,routes={};
 let account={handle:'Alice',handleKey:'alice',verifiedAt:new Date()};
 let atcAccount={handle:'AtcAlice',handleKey:'atcalice',verifiedAt:new Date()};
 const pdoc={docId:9,config:{type:'rmj',target:'4:A'}};
 const schemaNode={default(){return this},description(){return this},role(){return this}};
 const host={Handler:class{},BadRequestError:class extends Error{},Schema:{string:()=>Object.create(schemaNode),object:()=>Object.create(schemaNode)},PRIV:{PRIV_USER_PROFILE:1},PERM:{PERM_EDIT_PROBLEM:2},STATUS:{STATUS_ACCEPTED:1,STATUS_WRONG_ANSWER:2},
 db:{collection:name=>({findOne:async()=>name==='rmj.cf.accounts'?account:atcAccount})},
 ProblemModel:{get:async()=>pdoc,inc:async()=>incs++},DomainModel:{incUserInDomain:async()=>incs++},
 RecordModel:{add:async(...args)=>{records.push(args);return 'rid';},update:async()=>{}},
 JudgeResultCallbackContext:{end:async(...args)=>ends.push(args)}};
 Module._load=function(n,...rest){if(n==='hydrooj')return host;if(n==='js-yaml')return {};return original.call(this,n,...rest);};
 try {
 await require('../dist/rmj-hydro').installRmj({setting:{requestConfig:()=>({rmj:{atcoder:{username:'judge',password:'secret'}}})},on:(n,f)=>hooks[n]=f,Route:(n,p,h)=>{routes[n]=h}});
 const manage={session:{},UiContext:{},url:()=>'/manage/rmj/atcoder/test'};hooks['handler/after/SystemConfig#get'](manage);
 assert.equal(manage.UiContext.rmjAtcoderConfigTest.endpoint,'/manage/rmj/atcoder/test');
 atcoderOfficialApi.verifyCredentials=async()=> 'judge';const tester=new routes.rmj_atcoder_config_test();Object.assign(tester,{session:{rmjConfigCsrf:'x'},response:{}});
 await tester.post({csrf:'x'});assert.deepEqual(tester.response.body,{ok:true,username:'judge'});await assert.rejects(tester.post({csrf:'bad'}));
 assert.equal(hooks['handler/after/ProblemEdit#get'],undefined);
 const detailPage={pdoc,args:{},response:{template:'problem_detail.html',body:{page_name:'problem_detail'}}};
 hooks['handler/after/ProblemDetail#get'](detailPage);
 assert.equal(detailPage.response.template,'problem_detail.html');
 assert.equal(detailPage.response.body.page_name,'problem_detail');
 const configPage={pdoc,args:{},session:{},UiContext:{},response:{template:'problem_config.html'},url:()=>'/p/9/rmj'};
 hooks['handler/after/ProblemConfig#get'](configPage);
 assert.equal(configPage.response.template,'problem_config.html');
 assert.equal(configPage.UiContext.rmjConfig.target,'4:A');
 assert.ok(configPage.UiContext.rmjConfig.csrf);
 const make=()=>({pdoc,user:{_id:7},args:{domainId:'system',csrf:'token'},session:{rmjCsrf:'token'},response:{},limitRate:async()=>{},url:()=>'/record/rid'});
 const submit=hooks['handler/before/ProblemSubmit#post'];
 codeforcesApi.acceptance=async()=>({id:123,creationTimeSeconds:1000});
 assert.equal(await submit(make()),'after');assert.equal(records[0][5],false);assert.equal(ends[0][2].status,1);assert.equal(ends[0][2].score,100);assert.match(records[0][4],/remote AC verification/);
 codeforcesApi.acceptance=async()=>undefined;await submit(make());assert.equal(ends[1][2].score,0);
 const count=records.length;codeforcesApi.acceptance=async()=>{throw Error('network');};await assert.rejects(submit(make()),/network/);assert.equal(records.length,count);
 await assert.rejects(submit({...make(),args:{csrf:'wrong'}}));
 await assert.rejects(submit({...make(),tdoc:{rule:'homework'}}));
 account=null;await assert.rejects(submit(make()));
 assert.equal(await submit({...make(),pdoc:{config:{type:'default'}}}),undefined);
 pdoc.config={type:'rmj',subType:'atcoder',target:'abc385/abc385_b'};
 atcoderSubmissionsApi.acceptance=async handle=>{assert.equal(handle,'AtcAlice');return {id:456,epoch_second:2000};};
 assert.equal(await submit(make()),'after');assert.equal(ends.at(-1)[2].score,100);assert.match(records.at(-1)[4],/atcoder/);assert.match(records.at(-1)[4],/2000/);
 const atcPage=make();atcPage.response.body={};await hooks['handler/after/ProblemSubmit#get'](atcPage);
 assert.equal(atcPage.response.body.rmjBindRoute,'rmj_atcoder_bind');
 const atcCount=records.length;atcoderSubmissionsApi.acceptance=async()=>undefined;
 atcoderOfficialApi.acceptance=async(credentials,handle,problem)=>{assert.deepEqual(credentials,{username:'judge',password:'secret'});assert.equal(handle,'AtcAlice');assert.equal(problem.taskId,'abc385_b');return {id:789,epoch_second:3000};};
 assert.equal(await submit(make()),'after');assert.equal(ends.at(-1)[2].score,100);assert.match(records.at(-1)[4],/official authenticated/);
 atcoderOfficialApi.acceptance=async()=>undefined;await assert.rejects(submit(make()),/未检测到/);assert.equal(records.length,atcCount+1);
 atcAccount=null;await assert.rejects(submit(make()),/AtCoder/);
 }finally{Module._load=original;codeforcesApi.acceptance=oldAcceptance;atcoderSubmissionsApi.acceptance=oldAtCoder;atcoderOfficialApi.acceptance=oldAtCoderOfficial;atcoderOfficialApi.verifyCredentials=oldVerify;}
});
