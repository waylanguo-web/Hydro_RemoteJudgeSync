import { codeforcesApi } from './providers/codeforces';
import { parseCFProblem, cfUrl } from './services/rmj';
declare const require: (name: string) => any;
export async function installRmj(ctx: any) {
    const { Handler, PRIV, PERM, STATUS, db, ProblemModel, RecordModel, DomainModel,
        JudgeResultCallbackContext } = require('hydrooj');
    const { Buffer } = require('buffer');
    const yaml = require('js-yaml');
    const accounts = db.collection('rmj.cf.accounts');
    const csrf = (h: any) => h.session.rmjCsrf ||= crypto.randomUUID();
    const isRmj = (h: any) => h.pdoc?.config?.type === 'rmj';
    const rejectContest = (h: any) => { if (h.tdoc || h.args.tid) throw new Error('RMJ 初版仅支持日常练习，暂不支持比赛和作业。'); };
    const editable = (h: any, p: any) => h.user.own(p, PERM.PERM_EDIT_PROBLEM_SELF) || h.user.hasPerm(PERM.PERM_EDIT_PROBLEM);
    const load = async (h: any) => {
        const p = await ProblemModel.get(h.args.domainId, h.args.pid);
        if (!p) throw new Error('题目不存在。');
        if (!editable(h, p)) h.checkPerm(PERM.PERM_EDIT_PROBLEM);
        if (p.reference) throw new Error('请在原题所在域配置 RMJ，暂不支持引用题。');
        return p;
    };
    class RmjConfigHandler extends Handler {
        async get() {
            const pdoc = await load(this);
            this.response.template = 'rmj_config.html';
            this.response.body = { pdoc, target: pdoc.config?.type === 'rmj' ? pdoc.config.target : '', rmjCsrf: csrf(this) };
        }
        async post(args: any) {
            const pdoc = await load(this);
            if (args.csrf !== this.session.rmjCsrf || !args.csrf) throw new Error('请刷新页面后重试。');
            const target = parseCFProblem(String(args.target || ''));
            // Preserve unrelated config fields; store a real config.yaml through Hydro's model API.
            const raw = await ProblemModel.get(args.domainId, pdoc.docId, undefined, true);
            const config = typeof raw.config === 'string' ? yaml.load(raw.config || '{}') || {} : raw.config || {};
            config.type = 'rmj'; config.subType = 'codeforces'; config.target = `${target.contestId}:${target.index}`;
            delete config.langs;
            const serialized = yaml.dump(config);
            await ProblemModel.addTestdata(args.domainId, pdoc.docId, 'config.yaml', Buffer.from(serialized), this.user._id);
            // Hydro emits the file-change event asynchronously; persist before redirecting.
            await ProblemModel.edit(args.domainId, pdoc.docId, { config: serialized });
            this.response.redirect = this.url('problem_detail', { pid: pdoc.docId });
        }
    }
    ctx.Route('rmj_config', '/p/:pid/rmj', RmjConfigHandler, PRIV.PRIV_USER_PROFILE);
    ctx.on('handler/after/ProblemEdit#get', (h: any) => { h.response.template = 'rmj_problem_edit.html'; });
    ctx.on('handler/after/ProblemDetail#get', (h: any) => {
        if (!isRmj(h)) return;
        rejectContest(h);
        const p = parseCFProblem(h.pdoc.config.target || '');
        h.response.body.rmjUrl = cfUrl(p); h.response.body.rmjCanEdit = editable(h, h.pdoc);
        h.response.body.page_name = 'rmj_detail'; h.response.template = 'rmj_problem_detail.html';
    });
    ctx.on('handler/after/ProblemSubmit#get', async (h: any) => {
        if (!isRmj(h)) return;
        rejectContest(h);
        h.response.body.rmjUrl = cfUrl(parseCFProblem(h.pdoc.config.target || ''));
        h.response.body.rmjAccount = await accounts.findOne({ _id: h.user._id });
        h.response.body.rmjCsrf = csrf(h); h.response.body.page_name = 'rmj_submit';
        h.response.template = 'rmj_problem_submit.html';
    });
    ctx.on('handler/before/ProblemSubmit#post', async (h: any) => {
        if (!isRmj(h)) return;
        rejectContest(h);
        if (!h.args.csrf || h.args.csrf !== h.session.rmjCsrf) throw new Error('请刷新提交页面后重试。');
        if (h.args.pretest) throw new Error('RMJ 不支持自测。');
        await h.limitRate('rmj_check', 60, 2);
        const account = await accounts.findOne({ _id: h.user._id });
        if (!account?.verifiedAt) throw new Error('请先在账号设置中验证绑定 CF 账号。');
        const p = parseCFProblem(h.pdoc.config.target || '');
        // Fetch before creating a Hydro record: network errors must never become WA.
        const accepted = await codeforcesApi.acceptance(account.handle, p);
        const currentAccount = await accounts.findOne({ _id: h.user._id });
        if (currentAccount?.handleKey !== account.handleKey) throw new Error('绑定账号已变更，请重新检测。');
        const currentProblem = await ProblemModel.get(h.args.domainId, h.pdoc.docId);
        if (currentProblem?.config?.type !== 'rmj' || currentProblem.config.target !== h.pdoc.config.target) throw new Error('题目配置已变更，请刷新后重试。');
        const provenance = { source: 'RMJ remote AC verification (no local code submission)', platform: 'codeforces',
            handle: account.handle, problem: p, remoteSubmissionId: accepted?.id ?? null,
            remoteSubmittedAt: accepted?.creationTimeSeconds ?? null, synchronizedAt: new Date().toISOString() };
        const domainId = h.args.domainId;
        const rid = await RecordModel.add(domainId, h.pdoc.docId, h.user._id, '_', JSON.stringify(provenance, null, 2), false, { type: 'judge' });
        await RecordModel.update(domainId, rid, { rmj: provenance });
        await Promise.all([ProblemModel.inc(domainId, h.pdoc.docId, 'nSubmit', 1), DomainModel.incUserInDomain(domainId, h.user._id, 'nSubmit')]);
        await JudgeResultCallbackContext.end(domainId, rid, {
            status: accepted ? STATUS.STATUS_ACCEPTED : STATUS.STATUS_WRONG_ANSWER,
            score: accepted ? 100 : 0, time: 0, memory: 0,
            message: accepted ? `RMJ: 已验证 ${account.handle} 在 CF 的 AC，远端提交 ${accepted.id}，提交时间 ${new Date(accepted.creationTimeSeconds * 1000).toISOString()}。这是远程验证记录，不是本地代码评测。`
                : `RMJ: 已完整查询 ${account.handle} 的公开历史提交，未发现该题 AC。`,
        });
        h.response.body = { rid }; h.response.redirect = h.url('record_detail', { rid });
        return 'after';
    });
    // Never send these provenance records to the local judge on rejudge.
    ctx.on('handler/before-operation/RecordDetail', (h: any) => {
        if (h.rdoc?.rmj && h.args.operation === 'rejudge') throw new Error('RMJ 记录请回到题目提交页重新检测，不支持本地重评。');
    });
    ctx.on('handler/before-operation/ProblemDetail', (h: any) => {
        if (isRmj(h) && h.args.operation === 'rejudge') throw new Error('RMJ 不支持本地批量重评，请让学员重新检测。');
    });
}
