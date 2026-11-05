import { saveChallenge, getChallenge, consumeChallenge } from './challenge-store';
import { CodeforcesApi } from './providers/codeforces';
import { CFBindingService, type BindingStore, type Challenge } from './services/cf-binding';
declare const require: (name: string) => any;
/** Hydro is supplied by the host; do not bundle a second Hydro runtime. */
export async function install(ctx: any) {
    const { Handler, PRIV, db } = require('hydrooj');
    const accounts = db.collection('rmj.cf.accounts');
    const challenges = db.collection('rmj.cf.challenges');
    await accounts.createIndex({ handleKey: 1 }, { unique: true });
    await challenges.createIndex({ uid: 1 }, { unique: true });
    const store: BindingStore = {
        getBinding: uid => accounts.findOne({ _id: uid }),
        owner: handleKey => accounts.findOne({ handleKey }),
        saveChallenge: c => saveChallenge(challenges, c),
        getChallenge: uid => getChallenge(challenges, uid),
        consume: c => consumeChallenge(challenges, c),
        bind: async (c, submissionId) => {
            try { await accounts.insertOne({ _id: c.uid, handle: c.handle, handleKey: c.handleKey, submissionId, verifiedAt: new Date() }); }
            catch (e: any) { if (e.code === 11000) throw new Error('用户或 CF 账号已绑定，请刷新页面。'); throw e; }
        },
        unlink: async uid => { await challenges.deleteMany({ uid }); await accounts.deleteOne({ _id: uid }); },
    };
    const service = new CFBindingService(new CodeforcesApi(), store);
    const csrf = (h: any) => h.session.rmjCsrf ||= crypto.randomUUID();
    ctx.on('handler/after/HomeSettings#get', async (h: any) => {
        if (h.response.body.category !== 'account') return;
        h.response.body.rmjAccount = await store.getBinding(h.user._id);
        h.response.body.rmjCsrf = csrf(h);
        h.response.template = 'rmj_settings.html';
    });
    class CFBindingHandler extends Handler {
        async get() {
            this.response.template = 'rmj_cf_bind.html';
            this.response.body = { account: await store.getBinding(this.user._id),
                challenge: await store.getChallenge(this.user._id), rmjCsrf: csrf(this) };
        }
        async post(args: any) {
            if (!args.csrf || args.csrf !== this.session.rmjCsrf) throw new Error('页面验证已失效，请刷新后重试。');
            await this.limitRate('rmj_cf', 60, 6);
            let message = '';
            try {
                if (args.action === 'start') {
                    await this.limitRate('rmj_cf_start', 600, 5);
                    await service.start(this.user._id, String(args.handle || ''));
                } else if (args.action === 'check') {
                    await service.check(this.user._id); message = '绑定成功。';
                } else if (args.action === 'unlink') {
                    await service.unlink(this.user._id); message = '已解绑。';
                } else throw new Error('无效操作。');
            } catch (e: any) { message = e.message || '请求失败，请稍后重试。'; }
            await this.get();
            this.response.body.message = message;
        }
    }
    ctx.Route('rmj_cf_bind', '/home/rmj/codeforces', CFBindingHandler, PRIV.PRIV_USER_PROFILE);
}
