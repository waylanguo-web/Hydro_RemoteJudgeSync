import type { CFProblem } from '../providers/codeforces';
export function parseCFProblem(input: string): CFProblem {
    const value = input.trim();
    const m = value.match(/^(?:CF)?([1-9][0-9]{0,5})[:\s]?([A-Za-z][0-9]?)$/i)
        || value.match(/^https:\/\/codeforces\.com\/(?:contest\/([1-9][0-9]{0,5})\/problem\/([A-Za-z][0-9]?)|problemset\/problem\/([1-9][0-9]{0,5})\/([A-Za-z][0-9]?))\/?$/);
    if (!m) throw new Error('请输入 CF4A、4:A 或 Codeforces 官方题目链接。');
    return { contestId: Number(m[1] || m[3]), index: (m[2] || m[4]).toUpperCase() };
}
export function cfUrl(p: CFProblem): string { return `https://codeforces.com/contest/${p.contestId}/problem/${p.index}`; }
