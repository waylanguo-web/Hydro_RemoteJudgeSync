import { addPage, NamedPage, request, Notification, loadMonaco } from '@hydrooj/ui-default';
import { parseCFProblem, cfUrl, parseVJudgeProblem } from '../shared/cf-problem.js';
const rmjSchema = {
    type: 'object',
    properties: {
        enabled: { type: 'boolean' },
        platform: { enum: ['codeforces', 'vjudge'] },
        target: { type: 'string', minLength: 1 },
        localType: { type: 'string' },
    },
    required: ['enabled', 'platform', 'target'],
    additionalProperties: false,
};

addPage(new NamedPage('problem_detail', () => {
    if (!window.UiContext.rmjHybrid) return;
    const tags = document.querySelector('.problem__tags');
    if (!tags || tags.querySelector('[data-rmj-type]')) return;
    const label = document.createElement('span');
    label.className = 'problem__tag-item icon icon-book';
    label.dataset.rmjType = 'true';
    label.textContent = 'remoteJudge';
    tags.insertBefore(label, tags.children[1] || null);
}));

addPage(new NamedPage('problem_config', async () => {
    const data = window.UiContext.rmjConfig;
    const editor = document.getElementById('ProblemConfig');
    if (!data || !editor || document.getElementById('rmj-config-extension')) return;
    const { monaco } = await loadMonaco(['yaml']);
    const yamlDefaults = monaco.languages.yaml.yamlDefaults;
    const diagnostics = yamlDefaults.getDiagnosticsOptions();
    const schemas = (diagnostics.schemas || []).map(schema => schema.uri === 'https://hydro.js.org/schema/problemConfig.json'
        ? { ...schema, schema: { ...schema.schema, properties: { ...schema.schema.properties, rmj: rmjSchema } } }
        : schema);
    yamlDefaults.setDiagnosticsOptions({ ...diagnostics, schemas });
    const form = document.createElement('form');
    form.id = 'rmj-config-form';
    form.className = 'section';
    form.innerHTML = `<div class="section__header"><h2 class="section__title">评测配置</h2></div><div class="section__body">
<div class="row"><div class="medium-4 columns"><label>评测方式
<select class="select" name="rmj-mode" aria-label="评测方式" style="width:100%;margin-top:12px"><option value="native">仅本地评测</option><option value="rmj">启用 remoteJudge</option></select>
</label></div></div>
<div data-rmj-options><div class="row" style="margin-top:24px"><div class="medium-4 columns"><label>远程平台
<select class="select" name="rmj-platform" style="width:100%;margin-top:12px"><option value="codeforces">CF · Codeforces</option><option value="vjudge">VJudge</option></select>
</label></div></div>
<div class="row" style="margin-top:36px"><div class="medium-8 columns"><label>题目编号
<input class="textbox" name="rmj-target" required placeholder="CF2276A、2276A 或粘贴原题链接" style="width:100%;margin-top:12px"></label>
<p data-rmj-preview style="margin:8px 0 16px;display:none">原题：<a target="_blank" rel="noopener noreferrer"></a></p></div></div>
<p data-rmj-status role="status" style="display:none;margin:12px 0"></p></div>
<div class="row"><div class="columns"><button type="submit" class="button rounded primary" data-rmj-save>保存评测配置</button>
</div></div></div>`;
    if (typeof data.localStatus === "string") {
        const hint = document.createElement("p");
        hint.textContent = data.localStatus || "本地测试数据可用。";
        form.append(hint);
    }
    editor.before(form);
    const mode = form.querySelector('[name="rmj-mode"]');
    const options = form.querySelector('[data-rmj-options]');
    const platform = form.querySelector('[name="rmj-platform"]');
    const target = form.querySelector('[name="rmj-target"]');
    const save = form.querySelector('[data-rmj-save]');
    const status = form.querySelector('[data-rmj-status]');
    const preview = form.querySelector('[data-rmj-preview]');
    const link = preview.querySelector('a');
    mode.value = data.enabled ? 'rmj' : 'native';
    platform.value = data.platform === 'vjudge' ? 'vjudge' : 'codeforces';
    target.value = data.target || (data.enabled && /^CF[1-9][0-9]*[A-Z][0-9]?$/i.test(data.problemId || '') ? data.problemId : '');
    function extract(showError = false) {
        target.setCustomValidity('');
        status.style.display = 'none';
        preview.style.display = 'none';
        if (!target.value.trim()) return null;
        try {
            const problem = platform.value === 'vjudge' ? parseVJudgeProblem(target.value) : parseCFProblem(target.value);
            target.value = platform.value === 'vjudge' ? problem.target : `CF${problem.contestId}${problem.index}`;
            link.textContent = target.value;
            link.href = platform.value === 'vjudge' ? problem.url : cfUrl(problem);
            preview.style.display = '';
            return problem;
        } catch (e) {
            if (showError) { target.setCustomValidity(e.message); target.reportValidity(); }
            return null;
        }
    }
    function update() {
        const rmj = mode.value === 'rmj';
        options.style.display = rmj ? '' : 'none';
        editor.style.display = rmj && data.type === 'remoteJudge' ? 'none' : '';
        target.required = rmj;
        status.style.display = 'none';
    }
    async function persist() {
        const enabled = mode.value === 'rmj';
        if (enabled && (!extract(true) || !target.reportValidity())) return;
        save.disabled = true;
        try {
            await request.post(data.endpoint, { csrf: data.csrf, mode: enabled ? 'rmj' : 'default', platform: platform.value, target: target.value });
            Notification.success('评测设置已保存');
            window.location.reload();
        } catch (e) {
            status.textContent = e.message || '保存失败，请稍后重试。';
            status.style.display = '';
            Notification.error(status.textContent);
            save.disabled = false;
        }
    }
    mode.addEventListener('change', update);
    const updatePlatform = () => { target.placeholder = platform.value === 'vjudge' ? 'AtCoder-abc482_a 或 VJudge 题目链接' : 'CF2276A、2276A 或粘贴原题链接'; extract(); };
    platform.addEventListener('change', updatePlatform);
    target.addEventListener('input', () => { target.setCustomValidity(''); preview.style.display = 'none'; });
    target.addEventListener('change', () => extract(true));
    target.addEventListener('blur', () => extract());
    target.addEventListener('paste', () => setTimeout(() => extract(true), 0));
    form.addEventListener('submit', e => { e.preventDefault(); persist(); });
    updatePlatform();
    update();
}));
