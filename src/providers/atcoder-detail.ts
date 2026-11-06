export function submissionId(input: string, contest: string): number {
    let value = input.trim();
    if (/^https?:/i.test(value)) {
        const u = new URL(value);
        if (u.origin !== 'https://atcoder.jp' || u.username || u.password) throw new Error('请填写 AtCoder 官方提交链接。');
        const m = u.pathname.match(/^\/contests\/([^/]+)\/submissions\/(\d+)\/?$/);
        if (!m || m[1] !== contest) throw new Error('提交链接与当前比赛不匹配。');
        value = m[2];
    }
    if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error('请输入有效的提交 ID 或官方提交链接。');
    return Number(value);
}
const plain = (s: string) => s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
export function parseDetail(html: string, handle: string, contest: string, task: string, id: number) {
    // Only inspect the summary table: never trust text in submitted source code.
    const tables = html.match(/<table\b[^>]*>[\s\S]*?<\/table>/gi) || [];
    const summary = tables.find(t => /Submission Time|提出日時/.test(t));
    if (!summary) throw new Error('无法读取官方提交详情，可能需要登录或页面访问受到限制。');
    const fields = new Map<string, string>();
    for (const row of summary.match(/<tr\b[\s\S]*?<\/tr>/gi) || []) {
        const cells = row.match(/<t[hd]\b[^>]*>[\s\S]*?<\/t[hd]>/gi) || [];
        if (cells.length >= 2) fields.set(plain(cells[0]!), cells[1]!);
    }
    const field = (...keys: string[]): string => keys.map(k => fields.get(k)).find(v => !!v) || '';
    const user = field('User', 'ユーザ'); const problem = field('Task', '問題');
    const userPath = user.match(/href=["']\/users\/([^"'/]+)["']/)?.[1];
    const taskPath = problem.match(/href=["']\/contests\/([^/]+)\/tasks\/([^"']+)["']/);
    if (userPath?.toLowerCase() !== handle.toLowerCase()) throw new Error('提交者与当前绑定的 AtCoder 用户名不匹配。');
    if (!taskPath || taskPath[1] !== contest || taskPath[2] !== task) throw new Error('提交记录不属于当前题目。');
    const result = plain(field('Status', '結果')).split(' ')[0];
    if (!['AC','WA','TLE','MLE','RE','CE','OLE','IE'].includes(result)) throw new Error('该提交尚未评测完成或状态暂不支持，请稍后重试。');
    const metric = (s: string) => { const n = Number.parseFloat(plain(s)); return Number.isFinite(n) && n >= 0 ? n : undefined; };
    return { id, user_id: handle, contest_id: contest, problem_id: task, result,
        epoch_second: Math.floor(Date.parse(plain(field('Submission Time', '提出日時'))) / 1000) || 0,
        rawScore: metric(field('Score', '得点')), time: metric(field('Exec Time', '実行時間')),
        memory: metric(field('Memory', 'メモリ')), language: plain(field('Language', '言語')) };
}
export async function fetchDetail(handle: string, contest: string, task: string, input: string) {
    const id = submissionId(input, contest);
    const r = await fetch(`https://atcoder.jp/contests/${encodeURIComponent(contest)}/submissions/${id}?lang=en`,
        { redirect: 'manual', signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`AtCoder 官方详情无法访问（HTTP ${r.status}），请稍后重试。`);
    return parseDetail(await r.text(), handle, contest, task, id);
}
