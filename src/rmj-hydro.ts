import { codeforcesApi } from './providers/codeforces';
import { parseRemoteProblem } from '../shared/remote-problem';
import { atcoderSubmissionsApi } from './providers/atcoder-submissions';
import { atcoderOfficialApi } from './providers/atcoder-official';
import { fetchDetail } from './providers/atcoder-detail';
declare const require: (name: string) => any;
export async function installRmj(ctx: any) {
    const { Handler, PRIV, PERM, STATUS, Schema, BadRequestError, db, ProblemModel, RecordModel, DomainModel,
        JudgeResultCallbackContext } = require('hydrooj');
    const { Buffer } = require('buffer');
    const yaml = require('js-yaml');
    const accountStores: Record<string, any> = { codeforces: db.collection('rmj.cf.accounts'), atcoder: db.collection('rmj.atcoder.accounts') };
    const rmjSettings = ctx.setting.requestConfig(Schema.object({
        rmj: Schema.object({
            atcoder: Schema.object({
                username: Schema.string().default('').description('AtCoder 专用验证账号用户名'),
                password: Schema.string().default('').role('secret').description('AtCoder 专用验证账号密码（保存后隐藏）'),
            }).description('AtCoder 官方查询兜底'),
        }).description('RMJ 远程评测'),
    }));
    const getPlatform = (h: any) => {
        const platform = h.pdoc.config.subType || 'codeforces';
        if (!accountStores[platform]) throw new Error('不支持该 RMJ 平台。');
        return platform;
    };
    const csrf = (h: any) => h.session.rmjCsrf ||= crypto.randomUUID();
    const configCsrf = (h: any) => h.session.rmjConfigCsrf ||= crypto.randomUUID();
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
            this.response.redirect = this.url('problem_config', { pid: pdoc.docId });
        }
        async post(args: any) {
            const pdoc = await load(this);
            if (args.csrf !== this.session.rmjCsrf || !args.csrf) throw new Error('请刷新页面后重试。');
            if (!['rmj', 'default'].includes(args.mode)) throw new Error('请选择有效的题型。');
            const platform = args.platform || 'codeforces';
            const target = args.mode === 'rmj' ? parseRemoteProblem(platform, String(args.target || '')) : null;
            // Preserve unrelated config fields; store a real config.yaml through Hydro's model API.
            const raw = await ProblemModel.get(args.domainId, pdoc.docId, undefined, true);
            const config = typeof raw.config === 'string' ? yaml.load(raw.config || '{}') || {} : raw.config || {};
            if (target) {
                config.type = 'rmj'; config.subType = platform; config.target = target.target;
                delete config.langs;
            } else {
                if (config.type !== 'rmj') throw new Error('普通题请使用原生编辑器保存。');
                config.type = 'default'; delete config.subType; delete config.target;
            }
            const serialized = yaml.dump(config);
            await ProblemModel.addTestdata(args.domainId, pdoc.docId, 'config.yaml', Buffer.from(serialized), this.user._id);
            // Hydro emits the file-change event asynchronously; persist before redirecting.
            await ProblemModel.edit(args.domainId, pdoc.docId, { config: serialized });
            this.response.body = { ok: true };
            if (!this.request.json) this.response.redirect = this.url('problem_config', { pid: pdoc.docId });
        }
    }
    class RmjAtCoderConfigTestHandler extends Handler {
        async post(args: any) {
            if (!args.csrf || args.csrf !== this.session.rmjConfigCsrf) throw new BadRequestError('请刷新配置页面后重试。');
            try {
                const username = await atcoderOfficialApi.verifyCredentials(rmjSettings.rmj.atcoder);
                this.response.body = { ok: true, username };
            } catch (e: any) {
                throw new BadRequestError(e?.message || 'AtCoder 验证账号检测失败。');
            }
        }
    }
    ctx.Route('rmj_config', '/p/:pid/rmj', RmjConfigHandler, PRIV.PRIV_USER_PROFILE);
    ctx.Route('rmj_atcoder_config_test', '/manage/rmj/atcoder/test', RmjAtCoderConfigTestHandler, PRIV.PRIV_EDIT_SYSTEM);
    ctx.on('handler/after/SystemConfig#get', (h: any) => {
        h.UiContext.rmjAtcoderConfigTest = { csrf: configCsrf(h), endpoint: h.url('rmj_atcoder_config_test') };
    });
    ctx.on('handler/after/ProblemConfig#get', (h: any) => {
        h.UiContext.rmjConfig = {
            type: h.pdoc.config?.type, platform: h.pdoc.config?.subType || 'codeforces',
            target: h.pdoc.config?.target || '', problemId: h.pdoc.pid || '', csrf: csrf(h),
            endpoint: h.url('rmj_config', { pid: h.pdoc.docId }),
        };
    });
    ctx.on('handler/after/ProblemDetail#get', (h: any) => {
        if (!isRmj(h)) return;
        rejectContest(h);
        // Keep Hydro's original detail template, page name, tags and sidebar unchanged.

    });
    ctx.on('handler/after/ProblemSubmit#get', async (h: any) => {
        if (!isRmj(h)) return;
        rejectContest(h);
        const platform = getPlatform(h);
        h.response.body.rmjPlatform = platform;
        h.response.body.rmjPlatformName = platform === 'atcoder' ? 'AtCoder' : 'CF';
        h.response.body.rmjBindRoute = platform === 'atcoder' ? 'rmj_atcoder_bind' : 'rmj_cf_bind';
        h.response.body.rmjUrl = parseRemoteProblem(platform, h.pdoc.config.target || '').url;
        h.response.body.rmjAccount = await accountStores[platform].findOne({ _id: h.user._id });
        h.response.body.rmjCsrf = csrf(h); h.response.body.page_name = 'rmj_submit';
        h.response.body.rmjNeedId = !!h.args.rmjNeedId;
        h.response.template = 'rmj_problem_submit.html';
    });
    ctx.on('handler/before/ProblemSubmit#post', async (h: any) => {
        if (!isRmj(h)) return;
        rejectContest(h);
        if (!h.args.csrf || h.args.csrf !== h.session.rmjCsrf) throw new Error('请刷新提交页面后重试。');
        if (h.args.pretest) throw new Error('RMJ 不支持自测。');
        await h.limitRate('rmj_check', 60, 2);
        const platform = getPlatform(h);
        const platformName = platform === 'atcoder' ? 'AtCoder' : 'CF';
        const accounts = accountStores[platform];
        const account = await accounts.findOne({ _id: h.user._id });
        if (!account?.verifiedAt) throw new Error(`请先在账号设置中验证绑定 ${platformName} 账号。`);
        const p = parseRemoteProblem(platform, h.pdoc.config.target || '');
        // Fetch before creating a Hydro record: network errors must never become WA.
        let remote: any = platform === 'atcoder'
            ? await atcoderSubmissionsApi.acceptance(account.handle, { contestId: p.contestId, taskId: p.taskId })
            : await codeforcesApi.acceptance(account.handle, { contestId: p.contestId, index: p.index });
        let verificationSource = platform === 'atcoder' ? 'AtCoder Problems' : 'Codeforces API';
        if (platform === 'atcoder' && !remote) {
            if (!h.args.submissionId) {
                h.response.redirect = h.url('problem_submit', { pid: h.pdoc.docId }) + '?rmjNeedId=1';
                return 'after';
            }
            try {
                remote = await fetchDetail(account.handle, p.contestId!, p.taskId!, String(h.args.submissionId));
            } catch (e: any) {
                throw new BadRequestError(e?.message || 'AtCoder 官方查询失败，请稍后重试。');
            }
            verificationSource = 'AtCoder official submission detail';
        }
        if (platform === 'atcoder' && !remote) throw new BadRequestError('未检测到该绑定账号对此题的 AtCoder AC；本次不记录未通过。');
        const accepted = remote ? { id: remote.id, creationTimeSeconds: platform === 'atcoder' ? remote.epoch_second : remote.creationTimeSeconds } : undefined;
        const currentAccount = await accounts.findOne({ _id: h.user._id });
        if (currentAccount?.handleKey !== account.handleKey) throw new Error('绑定账号已变更，请重新检测。');
        const currentProblem = await ProblemModel.get(h.args.domainId, h.pdoc.docId);
        if (currentProblem?.config?.type !== 'rmj' || currentProblem.config.target !== h.pdoc.config.target || (currentProblem.config.subType || 'codeforces') !== platform) throw new Error('题目配置已变更，请刷新后重试。');
        const provenance = { source: 'RMJ remote AC verification (no local code submission)', verificationSource, platform,
            handle: account.handle, problem: p, remoteSubmissionId: accepted?.id ?? null,
            remoteSubmittedAt: accepted?.creationTimeSeconds ?? null, remoteDetails: platform === 'atcoder' ? remote : undefined,
            synchronizedAt: new Date().toISOString() };
        const domainId = h.args.domainId;
        const rid = await RecordModel.add(domainId, h.pdoc.docId, h.user._id, '_', JSON.stringify(provenance, null, 2), false, { type: 'judge' });
        await RecordModel.update(domainId, rid, { rmj: provenance });
        await Promise.all([ProblemModel.inc(domainId, h.pdoc.docId, 'nSubmit', 1), DomainModel.incUserInDomain(domainId, h.user._id, 'nSubmit')]);
        await JudgeResultCallbackContext.end(domainId, rid, {
            status: platform === 'atcoder' && remote?.result ? ({ AC: STATUS.STATUS_ACCEPTED, WA: STATUS.STATUS_WRONG_ANSWER,
                TLE: STATUS.STATUS_TIME_LIMIT_EXCEEDED, MLE: STATUS.STATUS_MEMORY_LIMIT_EXCEEDED,
                RE: STATUS.STATUS_RUNTIME_ERROR, CE: STATUS.STATUS_COMPILE_ERROR, OLE: STATUS.STATUS_OUTPUT_LIMIT_EXCEEDED,
                IE: STATUS.STATUS_SYSTEM_ERROR } as any)[remote.result] : accepted ? STATUS.STATUS_ACCEPTED : STATUS.STATUS_WRONG_ANSWER,
            score: accepted && (!remote.result || remote.result === 'AC') ? 100 : 0,
            time: remote?.time || 0, memory: remote?.memory || 0,
            message: accepted ? `RMJ: 已验证 ${account.handle} 在 ${platformName} 的 ${remote.result || 'AC'}，远端提交 ${accepted.id}。${remote.rawScore !== undefined ? '远端原始分数：' + remote.rawScore + '。' : ''}这是远程验证记录。`
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
