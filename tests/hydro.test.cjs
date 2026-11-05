const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
test('Hydro hook augments account settings only; route requires login and CSRF', async () => {
 const original = Module._load;
 const hooks = {}; let route;
 const collection = { createIndex: async () => {}, findOne: async () => null };
 class Handler {}
 Module._load = function(name, ...rest) {
  if (name === 'hydrooj') return { Handler, PRIV: { PRIV_USER_PROFILE: 123 }, db: { collection: () => collection } };
  return original.call(this, name, ...rest);
 };
 try {
  await require('../dist/hydro').install({ on: (n, f) => hooks[n] = f, Route: (...args) => route = args });
  assert.equal(route[1], '/home/rmj/codeforces'); assert.equal(route[3],123);
  const h = { user:{_id:7}, session:{}, response:{body:{category:'account'},template:'home_settings.html'} };
  await hooks['handler/after/HomeSettings#get'](h);
  assert.equal(h.response.template,'rmj_settings.html'); assert.ok(h.response.body.rmjCsrf);
  const other = { response:{body:{category:'preference'},template:'home_settings.html'} };
  await hooks['handler/after/HomeSettings#get'](other); assert.equal(other.response.template,'home_settings.html');
  const page = new route[2](); page.user = {_id:7}; page.session = h.session; page.response = {};
  await page.get(); assert.equal(page.response.template,'rmj_cf_bind.html');
  await assert.rejects(page.post({action:'unlink',csrf:'wrong'}));
 } finally { Module._load = original; }
});
