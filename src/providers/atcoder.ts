export interface AtCoderProfile { handle: string; affiliation: string }
function plain(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
        .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).trim();
}
export function parseProfile(html: string, requested: string): AtCoderProfile {
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (!title || plain(title[1]).toLowerCase() !== `${requested} - atcoder`.toLowerCase()) {
        throw new Error('AtCoder 返回的不是预期个人资料页面，请稍后重试。');
    }
    let affiliation = '';
    for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
        const label = row[1].match(/<th[^>]*>([\s\S]*?)<\/th>/i);
        const value = row[1].match(/<td[^>]*>([\s\S]*?)<\/td>/i);
        if (label && value && ['Affiliation', '所属'].includes(plain(label[1]))) affiliation = plain(value[1]);
    }
    return { handle: plain(title[1]).slice(0, -' - AtCoder'.length), affiliation };
}
export class AtCoderApi {
    private queue: Promise<unknown> = Promise.resolve();
    private last = 0;
    profile(handle: string): Promise<AtCoderProfile> {
        if (!/^[a-zA-Z0-9_]{1,16}$/.test(handle)) return Promise.reject(new Error('请输入有效的 AtCoder 用户名。'));
        const run = this.queue.then(async () => {
            await new Promise(r => setTimeout(r, Math.max(0, this.last + 1500 - Date.now())));
            this.last = Date.now();
            const response = await fetch(`https://atcoder.jp/users/${encodeURIComponent(handle)}?lang=en`, {
                signal: AbortSignal.timeout(15000), redirect: 'error', headers: { 'Cache-Control': 'no-cache' },
            });
            if (response.status === 404) throw new Error('AtCoder 用户不存在。');
            if (!response.ok) throw new Error('AtCoder 暂时无法访问，请稍后重试。');
            return parseProfile(await response.text(), handle);
        });
        this.queue = run.catch(() => undefined);
        return run;
    }
}
