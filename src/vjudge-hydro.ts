declare const require: (name: string) => any;
export function parseVJudgeProfile(html: string, requested: string) {
    const script = html.match(/<script\b[^>]*id=["']profile-header-data["'][^>]*>([\s\S]*?)<\/script>/i);
    if (!script) throw new Error('无法读取 VJudge 资料，请稍后重试。');
    const data = JSON.parse(script[1]!);
    if (typeof data.username !== 'string' || data.username.toLowerCase() !== requested.toLowerCase()) throw new Error('VJudge 返回的账号身份不匹配。');
    const school = html.match(/<dt\b[^>]*data-i18n=["']user\.profile\.school["'][^>]*>[\s\S]*?<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/i)?.[1] || '';
    return { handle: data.username as string, school: school.replace(/<[^>]*>/g, '').trim() };
}
let queue: Promise<unknown> = Promise.resolve();
let last = 0;
export async function profile(handle: string) {
    if (!/^[a-zA-Z0-9_-]{1,32}$/.test(handle)) throw new Error('请输入有效的 VJudge 用户名。');
    const run = queue.then(async () => {
        await new Promise(r => setTimeout(r, Math.max(0, last + 1500 - Date.now()))); last = Date.now();
        const r = await fetch(`https://vjudge.net/user/${encodeURIComponent(handle)}`, { redirect: 'error', signal: AbortSignal.timeout(15000) });
        if (!r.ok) throw new Error(`VJudge 资料暂不可访问（HTTP ${r.status}）。`);
        return parseVJudgeProfile(await r.text(), handle);
    }); queue = run.catch(() => undefined); return run;
}
export async function installVJudge(ctx: any) {
    const { Handler, PRIV, db } = require('hydrooj');
    const accounts = db.collection('rmj.vjudge.accounts'), challenges = db.collection('rmj.vjudge.challenges');
    await accounts.createIndex({ handleKey: 1 }, { unique: true });
    const csrf = (h: any) => h.session.rmjCsrf ||= crypto.randomUUID();
    ctx.on('handler/after/HomeSettings#get', async (h: any) => {
        if (h.response.body.category !== 'account') return;
        h.response.body.rmjVJudgeAccount = await accounts.findOne({ _id: h.user._id });
        h.response.body.rmjCsrf = csrf(h); h.response.template = 'rmj_settings.html';
    });
    class VJudgeBindingHandler extends Handler {
        async get() {
            this.response.template = 'rmj_vjudge_bind.html';
            this.response.body = { account: await accounts.findOne({ _id: this.user._id }),
                challenge: await challenges.findOne({ _id: this.user._id }), rmjCsrf: csrf(this) };
        }
        async post(args: any) {
            let message = '';
            try {
                if (!args.csrf || args.csrf !== this.session.rmjCsrf) throw new Error('请刷新页面后重试。');
                await this.limitRate('rmj_vjudge', 60, 6);
                const uid = this.user._id;
                if (args.action === 'unlink') {
                    await challenges.deleteOne({ _id: uid }); await accounts.deleteOne({ _id: uid }); message = '已解绑。';
                } else if (args.action === 'start') {
                    await this.limitRate('rmj_vjudge_start', 600, 5);
                    if (await accounts.findOne({ _id: uid })) throw new Error('请先解绑现有账号。');
                    const p = await profile(String(args.handle || '').trim());
                    if (await accounts.findOne({ handleKey: p.handle.toLowerCase() })) throw new Error('该 VJudge 账号已被绑定。');
                    await challenges.updateOne({ _id: uid }, { $set: { handle: p.handle, handleKey: p.handle.toLowerCase(),
                        token: 'RMJ-' + crypto.randomUUID().replace(/-/g, ''), expiresAt: Date.now() + 600000 } }, { upsert: true });
                } else if (args.action === 'check') {
                    const c = await challenges.findOne({ _id: uid });
                    if (!c || Date.now() > c.expiresAt) throw new Error('验证已过期，请重新开始。');
                    const p = await profile(c.handle);
                    if (Date.now() > c.expiresAt || p.school !== c.token) throw new Error('School 字段与验证码不匹配或验证已过期。');
                    const used = await challenges.deleteOne({ _id: uid, token: c.token });
                    if (used.deletedCount !== 1) throw new Error('验证已使用或被替换，请重新开始。');
                    await accounts.insertOne({ _id: uid, handle: p.handle, handleKey: c.handleKey, verifiedAt: new Date() }); message = '绑定成功，可恢复原 School 内容。';
                } else throw new Error('无效操作。');
            } catch (e: any) { message = e.code === 11000 ? '该账号或当前用户已绑定，请刷新页面。' : e.message || '请求失败，请稍后重试。'; }
            await this.get(); this.response.body.message = message;
        }
    }
    ctx.Route('rmj_vjudge_bind', '/home/rmj/vjudge', VJudgeBindingHandler, PRIV.PRIV_USER_PROFILE);
}
