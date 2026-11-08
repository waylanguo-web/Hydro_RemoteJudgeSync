import { addPage, NamedPage, request, Notification } from '@hydrooj/ui-default';
import { parseCFProblem, cfUrl, parseVJudgeProblem } from '../shared/cf-problem.js';

addPage(new NamedPage('problem_config', () => {
    const data = window.UiContext.rmjConfig;
    const editor = document.getElementById('ProblemConfig');
    if (!data || !editor || document.getElementById('rmj-config-extension')) return;
    const switcher = document.createElement('div');
    switcher.id = 'rmj-config-extension';
    switcher.className = 'section side';
    switcher.innerHTML = `<div class="section__header"><h1 class="section__title">评测方式</h1></div>
<div class="section__body"><select class="select" name="rmj-mode" aria-label="评测方式" style="width:100%">
<option value="native">本地评测（原生设置）</option><option value="rmj">RMJ · 远程 AC 验证</option>
</select><button type="button" class="button" data-rmj-restore style="display:none;margin-top:12px">保存并切换为本地评测</button></div>`;
    const sidebar = editor.closest('.row')?.querySelector('.medium-3.columns');
    if (sidebar) sidebar.prepend(switcher);
    else editor.before(switcher);
    const form = document.createElement('form');
    form.id = 'rmj-config-form';
    form.className = 'section__body';
    form.innerHTML = `<div class="row"><div class="medium-4 columns"><label>平台
<select class="select" name="rmj-platform" style="width:100%;margin-top:12px"><option value="codeforces">CF · Codeforces</option><option value="vjudge">VJudge</option></select>
</label></div></div>
<div class="row" style="margin-top:36px"><div class="medium-8 columns"><label>题目编号
<input class="textbox" name="rmj-target" required placeholder="CF2276A、2276A 或粘贴原题链接" style="width:100%;margin-top:12px"></label>
<p data-rmj-preview style="margin:8px 0 16px;display:none">原题：<a target="_blank" rel="noopener noreferrer"></a></p></div></div>
<div class="row" style="margin-top:36px"><div class="columns"><button type="submit" class="button rounded primary" data-rmj-save>保存</button>
<p data-rmj-status role="status" style="display:none;margin-top:12px"></p></div></div>`;
    if (typeof data.localStatus === "string") {
        const hint = document.createElement("p");
        hint.textContent = data.localStatus || "本地测试数据可用。";
        form.append(hint);
    }
    editor.before(form);
    const mode = switcher.querySelector('[name="rmj-mode"]');
    const restore = switcher.querySelector('[data-rmj-restore]');
    const platform = form.querySelector('[name="rmj-platform"]');
    const target = form.querySelector('[name="rmj-target"]');
    const save = form.querySelector('[data-rmj-save]');
    const status = form.querySelector('[data-rmj-status]');
    const preview = form.querySelector('[data-rmj-preview]');
    const link = preview.querySelector('a');
    mode.value = data.type === 'rmj' ? 'rmj' : 'native';
    platform.value = data.platform === 'vjudge' ? 'vjudge' : 'codeforces';
    target.value = data.target || (data.type === 'rmj' && /^CF[1-9][0-9]*[A-Z][0-9]?$/i.test(data.problemId || '') ? data.problemId : '');
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
        form.style.display = rmj ? '' : 'none';
        editor.style.display = rmj && data.type !== 'rmj' ? 'none' : '';
        restore.style.display = !rmj && data.type === 'rmj' ? '' : 'none';
        target.required = rmj;
        status.style.display = 'none';
    }
    async function persist(native = false) {
        if (!native && (!extract(true) || !target.reportValidity())) return;
        save.disabled = restore.disabled = true;
        try {
            await request.post(data.endpoint, { csrf: data.csrf, mode: native ? 'default' : 'rmj', platform: platform.value, target: target.value });
            Notification.success('评测设置已保存');
            window.location.reload();
        } catch (e) {
            status.textContent = e.message || '保存失败，请稍后重试。';
            status.style.display = '';
            Notification.error(status.textContent);
            save.disabled = restore.disabled = false;
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
    restore.addEventListener('click', () => persist(true));
    updatePlatform();
    update();
}));
