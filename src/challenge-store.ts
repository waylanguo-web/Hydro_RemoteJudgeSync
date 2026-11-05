import type { Challenge } from './services/cf-binding';
/** Keep MongoDB's immutable document ID separate from the renewable challenge token. */
export async function saveChallenge(collection: any, c: Challenge): Promise<void> {
    const { _id: challengeId, ...fields } = c;
    await collection.updateOne({ uid: c.uid }, { $set: { ...fields, challengeId } }, { upsert: true });
}
export async function getChallenge(collection: any, uid: number): Promise<Challenge | null> {
    const row = await collection.findOne({ uid });
    return row ? { ...row, _id: row.challengeId ?? row._id } : null;
}
export async function consumeChallenge(collection: any, c: Challenge): Promise<boolean> {
    const result = await collection.deleteOne({ uid: c.uid, $or: [
        { challengeId: c._id },
        { challengeId: { $exists: false }, _id: c._id },
    ] });
    return result.deletedCount === 1;
}
