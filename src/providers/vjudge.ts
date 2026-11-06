export class VJudgeApi {
    private queue: Promise<unknown> = Promise.resolve();
    private last = 0;
    async json(path: string): Promise<any> {
        const run = this.queue.then(async () => {
            await new Promise(r => setTimeout(r, Math.max(0, this.last + 1500 - Date.now()))); this.last = Date.now();
            const r = await fetch(`https://vjudge.net${path}`, { redirect: 'error', signal: AbortSignal.timeout(15000) });
            if (!r.ok) throw new Error(`VJudge 查询失败（HTTP ${r.status}），本次不记录成绩。`);
            const data = await r.json();
            if (!data || data.error) throw new Error('VJudge 拒绝查询，本次不记录成绩。');
            return data;
        }); this.queue = run.catch(() => undefined); return run;
    }
    async acceptance(handle: string, p: { oj: string; probNum: string }) {
        if (!/^[A-Za-z0-9_-]{1,32}$/.test(handle)) throw new Error('VJudge 绑定账号格式异常。');
        const data = await this.json(`/user/solveDetail/${encodeURIComponent(handle)}`);
        if (!data.acRecords || typeof data.acRecords !== 'object' || Array.isArray(data.acRecords)
            || !Object.values(data.acRecords).every(a => Array.isArray(a) && a.every(v => typeof v === 'string'))) {
            throw new Error('VJudge 通过列表格式异常，本次不记录成绩。');
        }
        if (!(data.acRecords[p.oj] || []).includes(p.probNum)) return undefined;
        // The complete solve list establishes AC; status rows only enrich provenance.
        const accepted: any = { id: null, creationTimeSeconds: null, time: 0, memory: 0 };
        try {
            const query = new URLSearchParams({ draw: '1', start: '0', length: '20', un: handle,
                OJId: p.oj, probNum: p.probNum, res: '1', onlyFollowee: 'false' });
            const result = await this.json(`/status/data?${query}`);
            const row = Array.isArray(result.data) && result.data.find((s: any) => s.userName?.toLowerCase() === handle.toLowerCase()
                && s.oj === p.oj && s.probNum === p.probNum && s.processing === false
                && (s.statusCanonical === 'AC' || s.status === 'Accepted') && Number.isSafeInteger(s.runId) && s.runId > 0);
            if (row) {
                accepted.id = row.runId;
                accepted.creationTimeSeconds = Number.isFinite(row.time) && row.time > 0 ? Math.floor(row.time / 1000) : null;
                accepted.time = Number.isFinite(row.runtime) && row.runtime >= 0 ? row.runtime : 0;
                accepted.memory = Number.isFinite(row.memory) && row.memory >= 0 ? row.memory : 0;
                accepted.language = row.language;
            }
        } catch { /* An unavailable detail list does not invalidate the verified solve list. */ }
        return accepted;
    }
}
export const vjudgeApi = new VJudgeApi();
