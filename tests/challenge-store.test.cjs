const { test } = require('node:test');
const assert = require('node:assert/strict');
const {saveChallenge,getChallenge,consumeChallenge}=require('../dist/challenge-store');
test('restarting challenge preserves Mongo ID, replaces token, and rejects stale consumption', async()=>{
 let row={_id:'legacy-token',uid:7,language:'C++17'};
 const collection={
  updateOne:async(filter,update)=>{assert.equal(filter.uid,7);assert.equal('_id' in update.$set,false);row={...row,...update.$set};},
  findOne:async()=>row,
  deleteOne:async q=>{const match=row && q.uid===row.uid && q.$or.some(f=>typeof f.challengeId==='string' ? f.challengeId===row.challengeId : row.challengeId===undefined && f._id===row._id);if(match)row=null;return {deletedCount:match?1:0};}
 };
 const old=await getChallenge(collection,7);assert.equal(old._id,'legacy-token');
 await saveChallenge(collection,{_id:'new-token',uid:7,language:'Kotlin 2.2.0'});
 assert.equal(row._id,'legacy-token');assert.equal((await getChallenge(collection,7))._id,'new-token');
 assert.equal(await consumeChallenge(collection,old),false);
 await saveChallenge(collection,{_id:'newer-token',uid:7,language:'Kotlin 2.2.0'});
 assert.equal(row._id,'legacy-token');assert.equal(await consumeChallenge(collection,{uid:7,_id:'new-token'}),false);
 assert.equal(await consumeChallenge(collection,await getChallenge(collection,7)),true);
 assert.equal(await getChallenge(collection,7),null);
});
