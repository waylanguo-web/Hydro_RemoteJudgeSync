import { AtCoderApi } from './providers/atcoder';
import { AtCoderBindingService, type AtCoderStore } from './services/atcoder-binding';
declare const require: (name: string) => any;
export async function installAtCoder(ctx: any) {
    const { Handler, PRIV, db } = require('hydrooj');
    const accounts = db.collection('rmj.atcoder.accounts');
    const challenges = db.collection('rmj.atcoder.challenges');
    await accounts.createIndex({ handleKey: 1 }, { unique: true });
    await challenges.createIndex({ uid: 1 }, { unique: true });
    const store: AtCoderStore = {
        account: uid => accounts.findOne({ _id: uid }), owner: handleKey => accounts.findOne({ handleKey }),
        save: async c => { await challenges.updateOne({ uid: c.uid }, { $set: c }, { upsert: true }); },
        challenge: uid => challenges.findOne({ uid }),
        consume: async c => (await challenges.deleteOne({ uid: c.uid, challengeId: c.challengeId })).deletedCount === 1,
        bind: async c => {
            try { await accounts.insertOne({ _id: c.uid, handle: c.handle, handleKey: c.handleKey, verifiedAt: new Date() }); }
            catch (e: any) { if (e.code === 11000) throw new Error('用户或 AtCoder 账号已绑定，请刷新页面。'); throw e; }
        },
        unlink: async uid => { await challenges.deleteMany({ uid }); await accounts.deleteOne({ _id: uid }); },
    };
    const service = new AtCoderBindingService(new AtCoderApi(), store);
    const csrf = (h: any) => h.session.rmjCsrf ||= crypto.randomUUID();
    ctx.on('handler/after/HomeSettings#get', async (h: any) => {
        if (h.response.body.category !== 'account') return;
        h.response.body.rmjAtCoderAccount = await store.account(h.user._id);
        h.response.body.rmjCsrf = csrf(h);
        h.response.template = 'rmj_settings.html';
    });
    class AtCoderBindingHandler extends Handler {
        async get() {
            this.response.template = 'rmj_atcoder_bind.html';
            this.response.body = { account: await store.account(this.user._id),
                challenge: await store.challenge(this.user._id), rmjCsrf: csrf(this) };
        }
        async post(args: any) {
            if (!args.csrf || args.csrf !== this.session.rmjCsrf) throw new Error('页面验证已失效，请刷新后重试。');
            await this.limitRate('rmj_atcoder', 60, 6);
            let message = '';
            try {
                if (args.action === 'start') {
                    await this.limitRate('rmj_atcoder_start', 600, 5);
                    await service.start(this.user._id, String(args.handle || ''));
                } else if (args.action === 'check') { await service.check(this.user._id); message = '绑定成功，可以恢复原来的所属内容。'; }
                else if (args.action === 'unlink') { await service.unlink(this.user._id); message = '已解绑。'; }
                else throw new Error('无效操作。');
            } catch (e: any) { message = e.message || '请求失败，请稍后重试。'; }
            await this.get(); this.response.body.message = message;
        }
    }
    ctx.Route('rmj_atcoder_bind', '/home/rmj/atcoder', AtCoderBindingHandler, PRIV.PRIV_USER_PROFILE);
}
