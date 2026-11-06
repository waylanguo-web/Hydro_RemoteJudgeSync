const {test}=require('node:test');const assert=require('node:assert/strict');
const {submissionId,parseDetail}=require('../dist/providers/atcoder-detail');
test('detail parser verifies ownership and task before syncing verdict and metrics',()=>{
 const html='<table>'+Object.entries({'Submission Time':'2026-11-06 12:00:00+0900',User:'<a href="/users/alice">alice</a>',Task:'<a href="/contests/abc482/tasks/abc482_a">A</a>',Status:'<span>WA</span>',Score:'0', 'Exec Time':'12 ms',Memory:'2048 KiB'}).map(([k,v])=>`<tr><th>${k}</th><td>${v}</td></tr>`).join('')+'</table>';
 const result=parseDetail(html,'Alice','abc482','abc482_a',99);assert.equal(result.result,'WA');assert.equal(result.time,12);assert.equal(result.memory,2048);
 assert.throws(()=>parseDetail(html,'bob','abc482','abc482_a',99),/用户名/);
 assert.throws(()=>parseDetail(html,'alice','abc482','abc482_b',99),/题目/);
 assert.throws(()=>parseDetail('<html>Sign In</html>','alice','abc482','abc482_a',99));
 assert.equal(submissionId('https://atcoder.jp/contests/abc482/submissions/99','abc482'),99);
 assert.throws(()=>submissionId('https://evil.test/contests/abc482/submissions/99','abc482'));
});
