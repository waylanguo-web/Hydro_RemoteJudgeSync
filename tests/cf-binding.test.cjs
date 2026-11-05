const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CFBindingService, matchesChallenge } = require('../dist/services/cf-binding');
function fixture() {
 let now = 1000, challenge, binding, taken = false, rows = [];
 const store = {
  getBinding: async () => binding, owner: async () => taken,
  saveChallenge: async c => { challenge = c; }, getChallenge: async () => challenge,
  consume: async c => { if (challenge?._id !== c._id) return false; challenge = undefined; return true; },
  bind: async (c, id) => { binding = { handle: c.handle, id }; },
  unlink: async () => { challenge = undefined; binding = undefined; },
 };
 const api = { user: async h => { if (h === 'missing') throw Error('not found'); return 'Tourist'; },
  problems: async () => [{ contestId: 1234, index: 'F' }], submissions: async () => rows };
 const svc = new CFBindingService(api, store, () => now, () => 0);
 return { svc, store, api, time: n => now = n, taken: () => taken = true,
  rows: r => rows = r, binding: () => binding };
}
function submission(c, patch = {}) { return { id: 9, creationTimeSeconds: c.startedAt,
 problem: c.problem, programmingLanguage: c.language, verdict: 'COMPILATION_ERROR',
 author: { members: [{ handle: 'TOURIST' }] }, ...patch }; }
test('full lifecycle: canonical handle, ten minute challenge, verify, unlink', async () => {
 const f = fixture(); const c = await f.svc.start(7, 'tourist');
 assert.equal(c.handle, 'Tourist'); assert.equal(c.expiresAt - c.startedAt, 600);
 f.rows([submission(c)]); await f.svc.check(7); assert.equal(f.binding().handle, 'Tourist');
 await assert.rejects(f.svc.check(7)); await assert.rejects(f.svc.start(7, 'tourist'));
 await f.svc.unlink(7); assert.equal(f.binding(), undefined);
});
test('rejects old/wrong language/wrong verdict/wrong problem/wrong author/team submissions', async () => {
 const f = fixture(); const c = await f.svc.start(7, 'tourist');
 for (const patch of [{creationTimeSeconds:c.startedAt-1},{creationTimeSeconds:c.expiresAt+1},
 {programmingLanguage:'GNU C++20'},{verdict:'OK'},{problem:{contestId:1,index:'A'}},
 {author:{members:[{handle:'other'}]}},{author:{members:[{handle:'Tourist'},{handle:'other'}]}}]) {
  assert.equal(matchesChallenge(c, submission(c, patch)), false);
  f.rows([submission(c, patch)]); await assert.rejects(f.svc.check(7));
 }
 assert.equal(f.binding(), undefined);
});
test('expiration and replacement invalidate previous challenge', async () => {
 const f = fixture(); const a = await f.svc.start(7, 'tourist');
 f.time(1100); const b = await f.svc.start(7, 'tourist'); assert.notEqual(a._id,b._id);
 f.rows([submission(a)]); await assert.rejects(f.svc.check(7));
 f.time(b.expiresAt+1); f.rows([submission(b)]); await assert.rejects(f.svc.check(7));
});
test('nonexistent account, duplicate ownership, and API failures never bind', async () => {
 const f = fixture(); await assert.rejects(f.svc.start(7,'missing'));
 f.taken(); await assert.rejects(f.svc.start(7,'tourist'));
 const g = fixture(); await g.svc.start(7,'tourist');
 g.api.submissions = async () => { throw Error('network'); };
 await assert.rejects(g.svc.check(7), /network/); assert.equal(g.binding(),undefined);
});
