import { localStatus, remoteTarget } from './rmj-local';
import { codeforcesApi } from './providers/codeforces';
import { parseCFProblem, cfUrl } from './services/rmj';
import { parseVJudgeProblem } from '../shared/cf-problem';
import { vjudgeApi } from './providers/vjudge';
declare const require: (name: string) => any;
export async function installRmj(ctx: any) {
    const { Handler, PRIV, PERM, STATUS, db, ProblemModel, RecordModel, DomainModel,
        JudgeResultCallbackContext } = require('hydrooj');
    const { Buffer } = require('buffer');
    const yaml = require('js-yaml');
    const accounts = db.collection('rmj.cf.accounts');
    const vjudgeAccounts = db.collection('rmj.vjudge.accounts');
    const platformOf = (h: any) => {
        const value = remoteTarget(h.pdoc).platform || 'codeforces';
        if (!['codeforces', 'vjudge'].includes(value)) throw new Error('不支持该 RMJ 平台。');
        return value;
    };
    const csrf = (h: any) => h.session.rmjCsrf ||= crypto.randomUUID();
    const isRmj = (h: any) => !!remoteTarget(h.pdoc);
    const rejectContest = (h: any) => { if (h.tdoc || h.args.tid) throw new Error('RMJ 初版仅支持日常练习，暂不支持比赛和作业。'); };
    const editable = (h: any, p: any) => h.user.own(p, PERM.PERM_EDIT_PROBLEM_SELF) || h.user.hasPerm(PERM.PERM_EDIT_PROBLEM);
    const load = async (h: any) => {
        const p = await ProblemModel.get(h.args.domainId, h.args.pid);
        if (!p) throw new Error('题目不存在。');
        if (!editable(h, p)) h.checkPerm(PERM.PERM_EDIT_PROBLEM);
        if (p.reference) throw new Error('请在原题所在域配置 RMJ，暂不支持引用题。');
        return p;
    };
    async function saveConfig(domainId: string, docId: number, owner: number, config: any) {
        const serialized = yaml.dump(config);
        await ProblemModel.addTestdata(domainId, docId, 'config.yaml', Buffer.from(serialized), owner);
        await ProblemModel.edit(domainId, docId, { config: serialized });
    }
    async function availability(doc: any) {
        const raw = await ProblemModel.get(doc.domainId, doc.docId, undefined, true);
        if (!raw?.data?.some((f: any) => f.name !== 'config.yaml')) return '尚未上传本地测试用例。';
        return localStatus(raw, yaml, require('@hydrooj/common'), require('@hydrooj/common/cases').readYamlCases);
    }
    async function convertLegacy(raw: any) {
        const config = typeof raw.config === 'string' ? yaml.load(raw.config) : raw.config;
        const target = raw.rmjTarget || config?.rmjTarget || (config?.type === 'rmj'
            ? { platform: config.subType || 'codeforces', target: config.target } : null);
        if (!target) return;
        await db.collection('rmj.local.backups').updateOne({ _id: raw._id }, {
            $setOnInsert: { domainId: raw.domainId, pid: raw.docId, config: raw.config, date: new Date() },
        }, { upsert: true });
        config.rmj = { enabled: true, platform: target.platform || 'codeforces', target: target.target };
        if (config.type === 'rmj') config.type = 'default';
        delete config.rmjTarget;
        delete config.subType;
        delete config.target;
        await saveConfig(raw.domainId, raw.docId, raw.owner, config);
        await db.collection('document').updateOne({ _id: raw._id }, { $unset: { rmjTarget: '' } });
    }
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
            if (!['codeforces', 'vjudge'].includes(platform)) throw new Error('不支持该平台。');
            const raw = await ProblemModel.get(args.domainId, pdoc.docId, undefined, true);
            await convertLegacy(raw);
            const config = typeof raw.config === 'string' ? yaml.load(raw.config || '{}') || {} : { ...(raw.config || {}) };
            if (args.mode === 'rmj') {
                const target: any = platform === 'vjudge' ? parseVJudgeProblem(String(args.target || '')) : parseCFProblem(String(args.target || ''));
                config.rmj = { enabled: true, platform, target: platform === 'vjudge' ? target.target : `${target.contestId}:${target.index}` };
                const files = raw.data || [];
                const localType = config.type === 'remote_judge' ? (config.rmj.localType || 'default') : (config.type || 'default');
                const hasFiles = files.some((f: any) => f.name !== 'config.yaml');
                if (hasFiles) {
                    config.type = localType;
                    delete config.rmj.localType;
                } else {
                    config.rmj.localType = localType;
                    config.type = 'remote_judge';
                }
            } else {
                delete config.rmj;
                if (config.type === 'remote_judge') config.type = config.rmj?.localType || 'default';
            }
            await saveConfig(args.domainId, pdoc.docId, this.user._id, config);
            this.response.body = { ok: true };
            if (!this.request.json) this.response.redirect = this.url('problem_config', { pid: pdoc.docId });
        }
    }
    ctx.Route('rmj_config', '/p/:pid/rmj', RmjConfigHandler, PRIV.PRIV_USER_PROFILE);
    ctx.on('handler/after/ProblemConfig#get', async (h: any) => {
        const type = isRmj(h) ? (h.pdoc.config.type === 'remoteJudge' ? 'remoteJudge' : h.pdoc.config.type) : h.pdoc.config?.type;
        h.UiContext.rmjConfig = {
            type, enabled: !!remoteTarget(h.pdoc), platform: remoteTarget(h.pdoc)?.platform || 'codeforces',
            target: remoteTarget(h.pdoc)?.target || '', problemId: h.pdoc.pid || '', csrf: csrf(h),
            endpoint: h.url('rmj_config', { pid: h.pdoc.docId }),
        };
        if (isRmj(h)) h.UiContext.rmjConfig.localStatus = await availability(h.pdoc);
    });
    ctx.on('handler/after/ProblemDetail#get', (h: any) => {
        if (!isRmj(h)) return;
        rejectContest(h);
        h.UiContext ||= {};
        h.UiContext.rmjHybrid = h.pdoc.config.type !== 'remote_judge';
    });
    ctx.on('handler/after/ProblemSubmit#get', async (h: any) => {
        if (!isRmj(h)) return;
        rejectContest(h);
        const reason = await availability(h.pdoc);
        h.response.body.rmjDual = !reason;
        if (!reason && h.args.mode !== 'remote') {
            h.response.template = 'rmj_local_submit.html';
            return;
        }
        const vj = platformOf(h) === 'vjudge';
        h.response.body.rmjPlatformName = vj ? 'VJudge' : 'CF';
        h.response.body.rmjBindRoute = vj ? 'rmj_vjudge_bind' : 'rmj_cf_bind';
        h.response.body.rmjUrl = vj ? parseVJudgeProblem(remoteTarget(h.pdoc).target || '').url : cfUrl(parseCFProblem(remoteTarget(h.pdoc).target || ''));
        h.response.body.rmjAccount = await (vj ? vjudgeAccounts : accounts).findOne({ _id: h.user._id });
        h.response.body.rmjCsrf = csrf(h); h.response.body.page_name = 'rmj_submit';
        h.response.template = 'rmj_problem_submit.html';
    });
    ctx.on('handler/before/ProblemSubmit#post', async (h: any) => {
        if (!isRmj(h)) return;
        rejectContest(h);
        if (h.args.mode !== 'remote' && (h.args.lang || h.args.code || h.request?.files?.file)) {
            const reason = await availability(h.pdoc);
            if (reason) throw new Error(reason);
            if (h.args.pretest) throw new Error('请选择正式递交。');
            return;
        }
        if (!h.args.csrf || h.args.csrf !== h.session.rmjCsrf) throw new Error('请刷新提交页面后重试。');
        if (h.args.pretest) throw new Error('RMJ 不支持自测。');
        await h.limitRate('rmj_check', 60, 2);
        const platform = platformOf(h), vj = platform === 'vjudge';
        const store = vj ? vjudgeAccounts : accounts;
        const account = await store.findOne({ _id: h.user._id });
        if (!account?.verifiedAt) throw new Error(`请先在账号设置中验证绑定 ${vj ? 'VJudge' : 'CF'} 账号。`);
        const p: any = vj ? parseVJudgeProblem(remoteTarget(h.pdoc).target || '') : parseCFProblem(remoteTarget(h.pdoc).target || '');
        // Fetch before creating a Hydro record: network errors must never become WA.
        const accepted = vj ? await vjudgeApi.acceptance(account.handle, p) : await codeforcesApi.acceptance(account.handle, p);
        const currentAccount = await store.findOne({ _id: h.user._id });
        if (currentAccount?.handleKey !== account.handleKey) throw new Error('绑定账号已变更，请重新检测。');
        const currentProblem = await ProblemModel.get(h.args.domainId, h.pdoc.docId);
        if (remoteTarget(currentProblem)?.target !== remoteTarget(h.pdoc).target || remoteTarget(currentProblem)?.platform !== platform) throw new Error('题目配置已变更，请刷新后重试。');
        const provenance = { source: 'RMJ remote AC verification (no local code submission)', platform,
            handle: account.handle, problem: p, remoteSubmissionId: accepted?.id ?? null,
            remoteSubmittedAt: accepted?.creationTimeSeconds ?? null, synchronizedAt: new Date().toISOString() };
        const domainId = h.args.domainId;
        const rid = await RecordModel.add(domainId, h.pdoc.docId, h.user._id, '_', JSON.stringify(provenance, null, 2), false, { type: 'judge' });
        await RecordModel.update(domainId, rid, { rmj: provenance });
        await Promise.all([ProblemModel.inc(domainId, h.pdoc.docId, 'nSubmit', 1), DomainModel.incUserInDomain(domainId, h.user._id, 'nSubmit')]);
        await JudgeResultCallbackContext.end(domainId, rid, {
            status: accepted ? STATUS.STATUS_ACCEPTED : STATUS.STATUS_WRONG_ANSWER,
            score: accepted ? 100 : 0, time: vj ? accepted?.time || 0 : 0, memory: vj ? accepted?.memory || 0 : 0,
            message: accepted ? `RMJ: 已验证 ${account.handle} 在 ${vj ? 'VJudge' : 'CF'} 的 AC。${accepted.id ? '远端提交 ' + accepted.id + '。' : ''}这是远程验证记录，不是本地代码评测。`
                : `RMJ: 已完整查询 ${account.handle} 的公开历史提交，未发现该题 AC。`,
        });
        h.response.body = { rid }; h.response.redirect = h.url('record_detail', { rid });
        return 'after';
    });
    // Never send these provenance records to the local judge on rejudge.
    ctx.on('handler/before-operation/RecordDetail', (h: any) => {
        if (h.rdoc?.rmj && h.args.operation === 'rejudge') throw new Error('RMJ 记录请回到题目提交页重新检测，不支持本地重评。');
    });
    ctx.on('handler/before-operation/ProblemDetail', async (h: any) => {
        if (h.args.operation !== 'rejudge') return;
        const domain = h.args.domainId, pid = h.pdoc.docId;
        if (!isRmj(h) && !await RecordModel.getMulti(domain, { pid, rmj: { $exists: true } }).limit(1).hasNext()) return;
        h.checkPerm(PERM.PERM_REJUDGE_PROBLEM);
        const reason = await availability(h.pdoc);
        if (reason) throw new Error(reason);
        const rows = await RecordModel.getMulti(domain, { pid, rmj: { $exists: false },
            code: { $not: /^\{\s*"source":\s*"RMJ remote AC verification/ },
            contest: { $nin: [RecordModel.RECORD_GENERATE, RecordModel.RECORD_PRETEST] },
            status: { $ne: STATUS.STATUS_CANCELED }, 'files.hack': { $exists: false },
        }).project({ _id: 1, contest: 1 }).toArray();
        if (rows.length) {
            const priority = await RecordModel.submissionPriority(h.user._id, -10050 - rows.length * 5);
            await RecordModel.reset(domain, rows.map((r: any) => r._id), true);
            for (const contest of [true, false]) {
                const ids = rows.filter((r: any) => !!r.contest === contest).map((r: any) => r._id);
                if (ids.length) await RecordModel.judge(domain, ids, priority, contest ? { detail: false } : {}, { rejudge: true });
            }
        }
        h.back();
        return 'after';
    });
    const documents = db.collection('document');
    if (documents.find) {
        const legacy = documents.find({ docType: 10, $or: [
            { config: /^type:\s*rmj\s*$/m }, { rmjTarget: { $exists: true } },
        ] });
        for await (const raw of legacy) await convertLegacy(raw);
    }
}
