const { test } = require('node:test');
const assert = require('node:assert/strict');
const { localStatus, remoteTarget } = require('../dist/rmj-local');

test('remote targets use independent configuration only', () => {
    const target = { enabled: true, platform: 'vjudge', target: '洛谷-P1003' };
    assert.equal(remoteTarget({ rmjConfig: target, config: { type: 'default' } }), target);
    assert.equal(remoteTarget({ config: { type: 'rmj', target: '4:A' } }), null);
    assert.equal(remoteTarget({ config: { type: 'default' } }), null);
});

test('availability uses judge files only and rechecks explicitly referenced cases', async () => {
    const doc = { config: { subtasks: [{ cases: [{ input: 'a.in', output: 'a.ans' }] }] },
        data: [{ name: 'a.in' }, { name: 'a.ans' }], additional_file: [{ name: 'a.ans' }] };
    const common = { normalizeSubtasks(groups, check) {
        for (const { cases } of groups) for (const c of cases) { check(c.input); check(c.output); }
    }, readSubtasksFromFiles: () => [] };
    const check = () => localStatus(doc, {}, common, async cfg => cfg);
    assert.equal(await check(), '');
    doc.data.pop();
    assert.match(await check(), /a.ans/);
    doc.config = {};
    assert.match(await check(), /未找到/);
});
