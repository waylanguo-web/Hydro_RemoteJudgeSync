import type { LuoguProfile } from '../providers/luogu';
export interface LuoguChallenge {
    uid: number; challengeId: string; handle: string; handleKey: string; displayName: string; token: string; expiresAt: number;
}
export interface LuoguStore {
    account(uid: number): Promise<any>;
    owner(handleKey: string): Promise<any>;
    save(c: LuoguChallenge): Promise<void>;
    challenge(uid: number): Promise<LuoguChallenge | null>;
    consume(c: LuoguChallenge): Promise<boolean>;
    bind(c: LuoguChallenge): Promise<void>;
    unlink(uid: number): Promise<void>;
}
export class LuoguBindingService {
    constructor(private api: { profile(handle: string): Promise<LuoguProfile> },
        private store: LuoguStore, private now = () => Math.floor(Date.now() / 1000)) {}
    async start(uid: number, input: string) {
        if (await this.store.account(uid)) throw new Error('请先解绑现有洛谷账号。');
        const profile = await this.api.profile(input.trim());
        const handleKey = profile.handle.toLowerCase();
        if (await this.store.owner(handleKey)) throw new Error('该洛谷账号已被绑定。');
        const challengeId = crypto.randomUUID();
        const c = { uid, challengeId, handle: profile.handle, handleKey,
            displayName: profile.displayName, token: `RMJ-${crypto.randomUUID().replace(/-/g, '')}`, expiresAt: this.now() + 600 };
        await this.store.save(c);
        return c;
    }
    async check(uid: number) {
        const c = await this.store.challenge(uid);
        if (!c || this.now() > c.expiresAt) throw new Error('验证已过期，请重新开始绑定。');
        const profile = await this.api.profile(c.handle);
        if (this.now() > c.expiresAt) throw new Error('验证已过期，请重新开始绑定。');
        if (profile.handle.toLowerCase() !== c.handleKey || profile.introduction !== c.token) {
            throw new Error('尚未检测到验证码，请确认已将个人介绍完整替换为验证码并保存。');
        }
        if (!await this.store.consume(c)) throw new Error('挑战已替换或使用，请刷新页面。');
        await this.store.bind(c);
    }
    unlink(uid: number) { return this.store.unlink(uid); }
}
