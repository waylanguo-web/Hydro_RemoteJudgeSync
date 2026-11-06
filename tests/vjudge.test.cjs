const {test}=require('node:test');const assert=require('node:assert/strict');
const {parseVJudgeProfile}=require('../dist/vjudge-hydro');
test('VJudge verification checks identity and only the School field',()=>{
 const html='<script id="profile-header-data">{"username":"Alice"}</script><dt data-i18n="user.profile.school">School:</dt><dd>RMJ-token</dd>';
 assert.deepEqual(parseVJudgeProfile(html,'alice'),{handle:'Alice',school:'RMJ-token'});
 assert.throws(()=>parseVJudgeProfile(html,'bob'));
 assert.equal(parseVJudgeProfile('<script id="profile-header-data">{"username":"Alice"}</script><p>RMJ-token</p>','alice').school,'');
 assert.throws(()=>parseVJudgeProfile('<title>Just a moment</title>','alice'));
});
