import type { AtCoderSubmission } from './atcoder-submissions';

export interface AtCoderOfficialCredentials { username?: string; password?: string }

/** Authenticated fallback for the official submissions page. */
export class AtCoderOfficialApi {
    private queue: Promise<unknown> = Promise.resolve();
    private cookies = '';
    private loggedInAs = '';

    private cookieHeader(headers: Headers) {
        const values = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [];
        return values.map(v => v.split(';', 1)[0]).join('; ');
    }

    private mergeCookies(next: string) {
        const jar = new Map(this.cookies.split('; ').filter(Boolean).map(v => {
            const i = v.indexOf('='); return [v.slice(0, i), v.slice(i + 1)];
        }));
        for (const value of next.split('; ').filter(Boolean)) {
            const i = value.indexOf('='); jar.set(value.slice(0, i), value.slice(i + 1));
        }
        this.cookies = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    }

    private async request(url: string, init: RequestInit = {}) {
        const headers = new Headers(init.headers);
        headers.set('user-agent', 'Hydro-RMJ/0.1 (+authenticated AtCoder verification)');
        if (this.cookies) headers.set('cookie', this.cookies);
        const response = await fetch(url, { ...init, headers, redirect: 'manual', signal: AbortSignal.timeout(15000) });
        this.mergeCookies(this.cookieHeader(response.headers));
        return response;
    }

    private csrf(html: string) {
        return html.match(/name=["']csrf_token["'][^>]*value=["']([^"']+)["']/i)?.[1]
            || html.match(/value=["']([^"']+)["'][^>]*name=["']csrf_token["']/i)?.[1];
    }

    private async login(credentials: AtCoderOfficialCredentials) {
        const username = String(credentials.username || '').trim();
        const password = String(credentials.password || '');
        if (!username || !password) throw new Error('管理员尚未在全局配置中填写 AtCoder 验证账号。');
        this.cookies = '';
        const page = await this.request('https://atcoder.jp/login?lang=en');
        if (!page.ok) throw new Error('无法打开 AtCoder 登录页面，请稍后重试。');
        const token = this.csrf(await page.text());
        if (!token) throw new Error('AtCoder 登录页面格式已变化，请管理员检查插件。');
        const body = new URLSearchParams({ username, password, csrf_token: token });
        const response = await this.request('https://atcoder.jp/login?lang=en', {
            method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body,
        });
        if (response.status < 300 || response.status >= 400 || !response.headers.get('location')) {
            throw new Error('AtCoder 验证账号登录失败，请管理员检查全局配置中的用户名和密码。');
        }
        this.loggedInAs = username;
    }

    private async submissions(handle: string, problem: { contestId: string; taskId: string }) {
        const url = new URL(`https://atcoder.jp/contests/${encodeURIComponent(problem.contestId)}/submissions`);
        url.searchParams.set('f.Task', problem.taskId);
        url.searchParams.set('f.Status', 'AC');
        url.searchParams.set('f.User', handle);
        return this.request(url.toString());
    }

    private parse(html: string, handle: string, problem: { contestId: string; taskId: string }): AtCoderSubmission | undefined {
        const rows = html.match(/<tr\b[\s\S]*?<\/tr>/gi) || [];
        const userPath = `/users/${handle}`.toLowerCase();
        const taskPath = `/contests/${problem.contestId}/tasks/${problem.taskId}`.toLowerCase();
        for (const row of rows) {
            const lower = row.toLowerCase();
            if (!lower.includes(`href="${userPath}"`) && !lower.includes(`href='${userPath}'`)) continue;
            if (!lower.includes(`href="${taskPath}"`) && !lower.includes(`href='${taskPath}'`)) continue;
            if (!/>\s*AC\s*</i.test(row)) continue;
            const id = Number(row.match(new RegExp(`/contests/${problem.contestId}/submissions/(\\d+)`, 'i'))?.[1]);
            if (!Number.isSafeInteger(id) || id <= 0) continue;
            const time = row.match(/<time\b[^>]*>([^<]+)<\/time>/i)?.[1]?.trim();
            const epoch = time ? Math.floor(Date.parse(time.replace(/([+-]\d\d)(\d\d)$/, '$1:$2')) / 1000) : 0;
            return { id, epoch_second: Number.isSafeInteger(epoch) ? epoch : 0, problem_id: problem.taskId,
                contest_id: problem.contestId, user_id: handle, result: 'AC' };
        }
        return undefined;
    }

    async acceptance(credentials: AtCoderOfficialCredentials, handle: string,
        problem: { contestId: string; taskId: string }): Promise<AtCoderSubmission | undefined> {
        const run = this.queue.then(async () => {
            const configuredAs = String(credentials.username || '').trim();
            if (!this.cookies || this.loggedInAs !== configuredAs) await this.login(credentials);
            let response = await this.submissions(handle, problem);
            const location = response.headers.get('location') || '';
            if (response.status === 302 && location.includes('/login')) {
                await this.login(credentials); response = await this.submissions(handle, problem);
            }
            if (!response.ok) throw new Error('AtCoder 官方提交记录暂时不可访问，请稍后重试。');
            const html = await response.text();
            if (/<title>\s*Sign In\s*-\s*AtCoder/i.test(html)) {
                this.cookies = ''; throw new Error('AtCoder 验证账号登录状态无效，请管理员检查全局配置。');
            }
            return this.parse(html, handle, problem);
        });
        this.queue = run.catch(() => undefined);
        return run;
    }
}

export const atcoderOfficialApi = new AtCoderOfficialApi();
