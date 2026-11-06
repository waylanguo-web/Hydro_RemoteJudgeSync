export interface LuoguProfile { handle: string; introduction: string; displayName: string }
export function normalizeUid(input: string): string {
    if (!/^[1-9][0-9]{0,9}$/.test(input)) throw new Error('请输入洛谷数字 UID，而不是用户名。');
    return input;
}
export function parseLuoguProfile(html: string, requested: string): LuoguProfile {
    normalizeUid(requested);
    const script = html.match(/<script\b(?=[^>]*\bid=["']lentille-context["'])[^>]*>([\s\S]*?)<\/script>/i);
    if (!script) throw new Error('无法读取洛谷公开资料：页面格式变化或访问受限，请稍后重试。');
    let context: any;
    try { context = JSON.parse(script[1]); } catch { throw new Error('洛谷资料格式异常，请稍后重试。'); }
    if (context.status === 404) throw new Error('洛谷用户不存在。');
    const user = context.data?.user;
    if (context.status !== 200 || context.template !== 'user.show' || !user
        || String(user.uid) !== requested || typeof user.name !== 'string'
        || typeof user.introduction !== 'string') {
        throw new Error('洛谷返回的不是预期公开资料，请稍后重试。');
    }
    return { handle: requested, introduction: user.introduction, displayName: user.name };
}
export class LuoguApi {
    private queue: Promise<unknown> = Promise.resolve();
    private last = 0;
    profile(uid: string): Promise<LuoguProfile> {
        normalizeUid(uid);
        const run = this.queue.then(async () => {
            await new Promise(r => setTimeout(r, Math.max(0, this.last + 2000 - Date.now())));
            this.last = Date.now();
            const response = await fetch(`https://www.luogu.com.cn/user/${uid}`, {
                signal: AbortSignal.timeout(15000), redirect: 'error', headers: { 'Cache-Control': 'no-cache' },
            });
            if (response.status === 404) throw new Error('洛谷用户不存在。');
            if (!response.ok) throw new Error('洛谷暂时无法访问或访问受限，请稍后重试。');
            return parseLuoguProfile(await response.text(), uid);
        });
        this.queue = run.catch(() => undefined);
        return run;
    }
}
