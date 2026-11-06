export interface AtCoderSubmission {
    id: number; epoch_second: number; problem_id: string; contest_id: string; user_id: string; result: string;
}
export class AtCoderSubmissionsApi {
    private queue: Promise<unknown> = Promise.resolve();
    private last = 0;
    async page(handle: string, from: number): Promise<AtCoderSubmission[]> {
        const run = this.queue.then(async () => {
            await new Promise(r => setTimeout(r, Math.max(0, this.last + 1200 - Date.now())));
            this.last = Date.now();
            const url = new URL('https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions');
            url.searchParams.set('user', handle); url.searchParams.set('from_second', String(from));
            const r = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'error' });
            if (!r.ok) throw new Error('AtCoder Problems 暂时不可访问，请稍后重试。');
            const rows = await r.json();
            if (!Array.isArray(rows) || rows.length > 500 || !rows.every(s =>
                Number.isSafeInteger(s.id) && Number.isSafeInteger(s.epoch_second) && s.epoch_second >= from
                && typeof s.problem_id === 'string' && typeof s.contest_id === 'string'
                && typeof s.user_id === 'string' && typeof s.result === 'string')) {
                throw new Error('AtCoder Problems 返回数据异常，本次不会记录成绩。');
            }
            return rows as AtCoderSubmission[];
        });
        this.queue = run.catch(() => undefined);
        return run;
    }
    async acceptance(handle: string, problem: { contestId: string; taskId: string }): Promise<AtCoderSubmission | undefined> {
        if (!/^[a-zA-Z0-9_]{1,16}$/.test(handle)) throw new Error('AtCoder 绑定账号格式异常，请重新绑定。');
        let from = 0;
        for (let i = 0; i < 200; i++) {
            const rows = await this.page(handle, from);
            const accepted = rows.find(s => s.user_id.toLowerCase() === handle.toLowerCase()
                && s.problem_id === problem.taskId && s.contest_id === problem.contestId && s.result === 'AC');
            if (accepted) return accepted;
            if (rows.length < 500) return undefined;
            // Inclusive overlap preserves other submissions from the final second.
            const next = Math.max(...rows.map(s => s.epoch_second));
            if (next <= from) throw new Error('AtCoder 分页时间边界无法继续，本次不会记录成绩。');
            from = next;
        }
        throw new Error('AtCoder 历史记录尚未扫描完成，本次不会记录成绩，请联系管理员。');
    }
}
export const atcoderSubmissionsApi = new AtCoderSubmissionsApi();
