import type { CFApi, CFProblem, CFSubmission } from '../providers/codeforces';
export interface Challenge {
    _id: string; uid: number; handle: string; handleKey: string;
    problem: CFProblem; language: string; startedAt: number; expiresAt: number;
}
export function matchesChallenge(c: Challenge, s: CFSubmission): boolean {
    return s.creationTimeSeconds >= c.startedAt && s.creationTimeSeconds <= c.expiresAt
        && s.problem.contestId === c.problem.contestId && s.problem.index === c.problem.index
        && s.programmingLanguage === c.language && s.verdict === 'COMPILATION_ERROR'
        && s.author.members.length === 1
        && s.author.members[0].handle.toLowerCase() === c.handleKey;
}
/** Structural storage contract keeps the verification core independently testable. */
export interface BindingStore {
    getBinding(uid: number): Promise<any>;
    owner(handleKey: string): Promise<any>;
    saveChallenge(c: Challenge): Promise<void>;
    getChallenge(uid: number): Promise<Challenge | null>;
    consume(c: Challenge): Promise<boolean>;
    bind(c: Challenge, submissionId: number): Promise<void>;
    unlink(uid: number): Promise<void>;
}
export class CFBindingService {
    constructor(private api: CFApi, private store: BindingStore,
        private now = () => Math.floor(Date.now() / 1000),
        private random = (n: number) => { const b = new Uint32Array(1); crypto.getRandomValues(b); return b[0] % n; }) {}
    async start(uid: number, input: string) {
        if (await this.store.getBinding(uid)) throw new Error('请先解绑现有 CF 账号。');
        const handle = await this.api.user(input.trim());
        const handleKey = handle.toLowerCase();
        if (await this.store.owner(handleKey)) throw new Error('该 CF 账号已经绑定其他用户。');
        const problems = await this.api.problems();
        if (!problems.length) throw new Error('暂无可用验证题。');
        const startedAt = this.now() + 1;
        const c: Challenge = { _id: crypto.randomUUID(), uid, handle, handleKey,
            problem: problems[this.random(problems.length)], language: 'GNU C++17',
            startedAt, expiresAt: startedAt + 600 };
        await this.store.saveChallenge(c);
        return c;
    }
    async check(uid: number) {
        const c = await this.store.getChallenge(uid);
        if (!c || this.now() > c.expiresAt) throw new Error('验证已过期，请重新开始绑定。');
        const rows = await this.api.submissions(c.handle);
        if (this.now() > c.expiresAt) throw new Error('验证已过期，请重新开始绑定。');
        const s = rows.find(s => matchesChallenge(c, s));
        if (!s) throw new Error('尚未找到符合要求的 CE 提交，请确认题目、语言和提交时间后重试。');
        if (!await this.store.consume(c)) throw new Error('验证已使用或已被新挑战替换，请刷新页面。');
        await this.store.bind(c, s.id);
        return c.handle;
    }
    unlink(uid: number) { return this.store.unlink(uid); }
}
