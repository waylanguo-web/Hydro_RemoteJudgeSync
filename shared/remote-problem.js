const { parseCFProblem, cfUrl } = require('./cf-problem');
function parseAtCoderProblem(input) {
    const value = input.trim().toLowerCase();
    let contestId, taskId;
    if (/^https?:\/\//.test(value)) {
        let url; try { url = new URL(value); } catch {}
        if (!url || url.hostname !== 'atcoder.jp' || url.username || url.password) throw new Error('请输入 AtCoder 官方题目链接。');
        const m = url.pathname.match(/^\/contests\/([a-z0-9_-]+)\/tasks\/([a-z0-9_]+)\/?$/);
        if (m) [, contestId, taskId] = m;
    } else {
        const explicit = value.match(/^([a-z0-9_-]+)\/([a-z0-9_]+)$/);
        if (explicit) [, contestId, taskId] = explicit;
        else {
            const simple = value.match(/^([a-z0-9-]+)_([a-z0-9]+)$/);
            if (simple) { contestId = simple[1]; taskId = value; }
        }
    }
    if (!contestId || !taskId) throw new Error('请输入 abc385_b 或 AtCoder 官方题目链接；特殊题号请使用完整链接。');
    return { contestId, taskId };
}
function parseRemoteProblem(platform, input) {
    if (platform === 'codeforces') {
        const p = parseCFProblem(input);
        return { ...p, platform, target: `${p.contestId}:${p.index}`, label: `CF${p.contestId}${p.index}`, url: cfUrl(p) };
    }
    if (platform === 'atcoder') {
        const p = parseAtCoderProblem(input);
        return { ...p, platform, target: `${p.contestId}/${p.taskId}`, label: p.taskId,
            url: `https://atcoder.jp/contests/${p.contestId}/tasks/${p.taskId}` };
    }
    throw new Error('请选择 CF 或 AtCoder 平台。');
}
module.exports = { parseAtCoderProblem, parseRemoteProblem };
