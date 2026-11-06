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
module.exports = { parseCFProblem, cfUrl };
