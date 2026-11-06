const {test}=require('node:test');const assert=require('node:assert/strict');
const {AtCoderOfficialApi}=require('../dist/providers/atcoder-official');

test('official AtCoder fallback logs in and validates the exact AC row',async()=>{
 const api=new AtCoderOfficialApi();let calls=[];
 api.request=async(url,init={})=>{
  calls.push([url,init.method||'GET']);
  if(url.includes('/login')&&!init.method)return new Response('<input name="csrf_token" value="token">',{status:200});
  if(url.includes('/login'))return new Response('',{status:302,headers:{location:'/'}});
  return new Response(`<table><tr><td><time>2026-11-06 12:34:56+0900</time></td><td><a href="/contests/abc482/tasks/abc482_a">A</a></td><td><a href="/users/warming">warming</a></td><td><span>AC</span></td><td><a href="/contests/abc482/submissions/9001">Detail</a></td></tr></table>`,{status:200});
 };
 const row=await api.acceptance({username:'judge',password:'pw'},'warming',{contestId:'abc482',taskId:'abc482_a'});
 assert.equal(row.id,9001);assert.equal(row.user_id,'warming');assert.ok(row.epoch_second>0);assert.equal(calls.length,3);
});

test('official AtCoder fallback rejects rows for another user, task or verdict',async()=>{
 const api=new AtCoderOfficialApi();api.cookies='x=1';api.loggedInAs='judge';
 for(const html of [
  '<tr><td><a href="/contests/abc482/tasks/abc482_a">A</a><a href="/users/other">other</a><span>AC</span><a href="/contests/abc482/submissions/1">D</a></td></tr>',
  '<tr><td><a href="/contests/abc482/tasks/abc482_b">B</a><a href="/users/warming">warming</a><span>AC</span><a href="/contests/abc482/submissions/2">D</a></td></tr>',
  '<tr><td><a href="/contests/abc482/tasks/abc482_a">A</a><a href="/users/warming">warming</a><span>WA</span><a href="/contests/abc482/submissions/3">D</a></td></tr>',
 ]){api.submissions=async()=>new Response(html,{status:200});assert.equal(await api.acceptance({username:'judge',password:'pw'},'warming',{contestId:'abc482',taskId:'abc482_a'}),undefined);}
});
