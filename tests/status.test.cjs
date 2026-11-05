const { test } = require('node:test');
const assert = require('node:assert/strict');
const { findAcceptance } = require('../dist/services/status');
const problem = { platform: 'atcoder', remoteId: 'abc385_b', remoteUrl: 'https://atcoder.jp/contests/abc385/tasks/abc385_b' };
const record = { platform: 'atcoder', remoteId: 'abc385_b', submissionId: '1', submittedAt: 100 };
test('matches platform and problem and preserves deadline boundaries', () => {
    assert.equal(findAcceptance(problem, [record], { start: 100, end: 100 }), record);
    assert.equal(findAcceptance(problem, [record], { end: 99 }), undefined);
    assert.equal(findAcceptance(problem, [{ ...record, platform: 'luogu' }]), undefined);
    assert.equal(findAcceptance(problem, [{ ...record, remoteId: 'other' }]), undefined);
});
test('selects earliest eligible remote acceptance without mutating input', () => {
    const rows = [{ ...record, submittedAt: 110 }, record];
    assert.equal(findAcceptance(problem, rows), record);
    assert.equal(rows[0].submittedAt, 110);
});
