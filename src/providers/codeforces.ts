export interface CFSubmission {
    id: number; creationTimeSeconds: number;
    problem: { contestId: number; index: string };
    author: { members: { handle: string }[]; participantType?: string };
    programmingLanguage: string; verdict?: string;
}
export interface CFProblem { contestId: number; index: string }
export interface CFApi {
    user(handle: string): Promise<string>;
    problems(): Promise<CFProblem[]>;
    submissions(handle: string): Promise<CFSubmission[]>;
}
export class CodeforcesApi implements CFApi {
    private queue: Promise<unknown> = Promise.resolve();
    private last = 0;
    private cache?: { until: number; rows: CFProblem[] };
    private call<T>(method: string, params: Record<string, string> = {}): Promise<T> {
        const run = this.queue.then(async () => {
            await new Promise(resolve => setTimeout(resolve, Math.max(0, this.last + 2100 - Date.now())));
            this.last = Date.now();
            const response = await fetch(`https://codeforces.com/api/${method}?${new URLSearchParams(params)}`, { signal: AbortSignal.timeout(15000) });
            if (!response.ok) throw new Error('CF 暂时无法访问，请稍后重试。');
            const data = await response.json() as { status: string; result: T };
            if (data.status !== 'OK') throw new Error('CF 查询失败：用户名不存在或服务暂时不可用。');
            return data.result;
        });
        this.queue = run.catch(() => undefined);
        return run;
    }
    async user(handle: string) {
        if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(handle)) throw new Error('请输入有效的 CF 用户名。');
        const users = await this.call<{ handle: string }[]>('user.info', { handles: handle });
        if (!users[0]?.handle) throw new Error('CF 用户不存在。');
        return users[0].handle;
    }
    async problems() {
        if (this.cache && this.cache.until > Date.now()) return this.cache.rows;
        const data = await this.call<{ problems: (CFProblem & { type: string; tags: string[] })[]; problemStatistics: (CFProblem & { solvedCount: number })[] }>('problemset.problems');
        const counts = new Map(data.problemStatistics.map(p => [`${p.contestId}:${p.index}`, p.solvedCount]));
        const rows = data.problems.filter(p => p.contestId > 0 && p.type === 'PROGRAMMING'
            && !p.tags.includes('interactive') && !p.tags.includes('output-only')
            && (counts.get(`${p.contestId}:${p.index}`) ?? Infinity) <= 1000);
        if (!rows.length) throw new Error('暂无可用验证题，请稍后重试。');
        this.cache = { rows, until: Date.now() + 3600000 };
        return rows;
    }
    /** Scan history until exhausted; never report not accepted from an incomplete scan. */
    async acceptance(handle: string, problem: CFProblem): Promise<CFSubmission | undefined> {
        for (let from = 1; from <= 100000; from += 1000) {
            const page = await this.call<CFSubmission[]>('user.status', { handle, from: String(from), count: '1000' });
            const accepted = page.find(s => s.verdict === 'OK'
                && s.problem.contestId === problem.contestId && s.problem.index === problem.index
                && s.author.members.length === 1
                && s.author.members[0].handle.toLowerCase() === handle.toLowerCase());
            if (accepted) return accepted;
            if (page.length < 1000) return undefined;
        }
        throw new Error('历史记录扫描尚未完成，请联系管理员；本次不会判为未通过。');
    }
    async submissions(handle: string) {
        const rows: CFSubmission[] = [];
        for (let from = 1; from <= 10000; from += 1000) {
            const page = await this.call<CFSubmission[]>('user.status', { handle, from: String(from), count: '1000' });
            rows.push(...page);
            // A ten-minute challenge cannot require scanning older history.
            if (page.length < 1000 || page[page.length - 1].creationTimeSeconds < Date.now() / 1000 - 1200) return rows;
        }
        throw new Error('提交记录过多，请稍后重试。');
    }
}

export const codeforcesApi = new CodeforcesApi();
