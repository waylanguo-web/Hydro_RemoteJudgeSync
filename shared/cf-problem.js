/** Shared by the settings form and server: accept identifiers or official problem URLs. */
function parseCFProblem(input) {
    const value = input.trim();
    let match = value.match(/^(?:CF\s*)?([1-9][0-9]{0,5})[\s:/]*([A-Za-z][0-9]?)$/i);
    if (!match) {
        let url;
        try { url = new URL(value); } catch { /* report the same actionable error below */ }
        if (url && ['http:', 'https:'].includes(url.protocol)
            && ['codeforces.com', 'www.codeforces.com'].includes(url.hostname)
            && !url.username && !url.password) {
            match = url.pathname.match(/^\/contest\/([1-9][0-9]{0,5})\/problem\/([A-Za-z][0-9]?)\/?$/i)
                || url.pathname.match(/^\/problemset\/problem\/([1-9][0-9]{0,5})\/([A-Za-z][0-9]?)\/?$/i);
        }
    }
    if (!match) throw new Error('请输入 CF2276A、2276A 或 Codeforces 官方题目链接。');
    return { contestId: Number(match[1]), index: match[2].toUpperCase() };
}
function cfUrl(p) { return `https://codeforces.com/contest/${p.contestId}/problem/${p.index}`; }
function parseVJudgeProblem(input) {
    let value = input.trim();
    if (/^https?:/i.test(value)) {
        const u = new URL(value);
        if (['www.luogu.com.cn', 'luogu.com.cn'].includes(u.hostname)
            && !u.username && !u.password && !u.port) {
            const id = u.pathname.match(/^\/problem\/(P[1-9][0-9]*)\/?$/i)?.[1];
            if (!id) throw new Error('请输入洛谷题目链接，例如 https://www.luogu.com.cn/problem/P17827。');
            return parseVJudgeProblem(`洛谷-${id.toUpperCase()}`);
        }
        if (!['http:', 'https:'].includes(u.protocol) || u.hostname !== 'vjudge.net' || u.username || u.password || u.port) throw new Error('请输入 VJudge 官方题目链接。');
        const encoded = u.pathname.match(/^\/problem\/([^/]+)\/?$/)?.[1] || '';
        try { value = decodeURIComponent(encoded); } catch { throw new Error('VJudge 题目链接编码不正确。'); }
    }
    const m = value.match(/^([\p{L}][\p{L}\p{N}]{0,63})-([A-Za-z0-9_][A-Za-z0-9_.-]{0,127})$/u);
    if (!m) throw new Error('请输入 AtCoder-abc482_a 等完整 VJudge 题号或官方题目链接。');
    return { oj: m[1], probNum: m[2], target: value, url: `https://vjudge.net/problem/${encodeURIComponent(value)}` };
}
module.exports = { parseCFProblem, cfUrl, parseVJudgeProblem };
