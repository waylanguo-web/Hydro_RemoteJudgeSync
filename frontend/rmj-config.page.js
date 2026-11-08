import { addPage, NamedPage, request, Notification } from '@hydrooj/ui-default';
import { parseCFProblem, cfUrl, parseVJudgeProblem } from '../shared/cf-problem.js';
addPage(new NamedPage('problem_detail', () => {
    if (!window.UiContext.rmjHybrid) return;
    const tags = document.querySelector('.problem__tags');
    if (!tags || tags.querySelector('[data-rmj-type]')) return;
    const label = document.createElement('span');
    label.className = 'problem__tag-item icon icon-book';
    label.dataset.rmjType = 'true';
    label.textContent = 'RMJ';
    tags.insertBefore(label, tags.children[1] || null);
}));

addPage(new NamedPage('problem_config', async () => {
    const data = window.UiContext.rmjConfig;
    const editor = document.getElementById('ProblemConfig');
    if (!data || !editor || document.getElementById('rmj-config-form')) return;
    const form = document.createElement('form');
    form.id = 'rmj-config-form';
    form.className = 'section__body';
    form.innerHTML = `<style>
#rmj-config-form{padding:20px 0;margin:0;box-shadow:none}
#rmj-config-form .rmj-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:14px}
#rmj-config-form h2{font-size:16px;font-weight:600;margin:0}
#rmj-config-form .rmj-grid{display:grid;grid-template-columns:minmax(150px,1fr) minmax(240px,2fr);gap:16px}
#rmj-config-form label{display:block;font-size:13px;color:#555;margin:0}
#rmj-config-form .select,#rmj-config-form .textbox{width:100%;margin:6px 0 0;height:36px;box-sizing:border-box}
#rmj-config-form .rmj-mode{display:flex;align-items:center;gap:12px}
#rmj-config-form .rmj-mode .select{width:150px;margin:0}
#rmj-config-form .rmj-footer{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:14px}
#rmj-config-form .rmj-note{font-size:13px;color:#888;margin:0;line-height:1.6}
#rmj-config-form [data-rmj-preview]{font-size:13px;margin:8px 0 0}
#rmj-config-form [data-rmj-status]{font-size:13px;color:#d4380d;margin:10px 0 0}
#rmj-config-form .button{margin:0;white-space:nowrap}
@media(max-width:640px){#rmj-config-form{padding:16px}#rmj-config-form .rmj-grid{grid-template-columns:1fr}#rmj-config-form .rmj-heading,#rmj-config-form .rmj-footer{align-items:flex-start;flex-direction:column}}
</style>
<div class="rmj-heading"><h2>RMJ 远程验证</h2><label class="rmj-mode">启用状态
<select class="select" name="rmj-mode" aria-label="RMJ 启用状态"><option value="native">未启用</option><option value="rmj">已启用</option></select></label></div>
<div data-rmj-options><div class="rmj-grid"><label>远程平台
<select class="select" name="rmj-platform"><option value="codeforces">Codeforces</option><option value="vjudge">VJudge</option></select></label>
<label>题目编号或原题链接<input class="textbox" name="rmj-target" required placeholder="CF2276A 或原题链接"></label></div>
<p data-rmj-preview style="display:none">原题：<a target="_blank" rel="noopener noreferrer"></a></p></div>
<div class="rmj-footer"><p class="rmj-note" data-rmj-hint></p><button type="submit" class="button primary rounded" data-rmj-save>保存 RMJ 设置</button></div>
<p data-rmj-status role="status" style="display:none"></p>`;
    const hint = form.querySelector('[data-rmj-hint]');
    hint.textContent = data.localStatus
        ? '本地评测：' + data.localStatus + ' 启用 RMJ 后可验证远程 AC。'
        : '验证绑定账号的远程 AC；本地评测在下方单独配置和保存。';
    // Mount alongside Hydro's native panels after its async React editor loads.
    form.hidden = true;
    form.style.setProperty('display', 'none', 'important');
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.id = 'rmj-config-tab';
    tab.textContent = 'RMJ';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', form.id);
    tab.setAttribute('aria-selected', 'false');
    form.setAttribute('role', 'tabpanel');
    form.setAttribute('aria-labelledby', tab.id);
    let active = false;
    let root;
    const styling = document.createElement('style');
    styling.textContent = '#rmj-config-form[hidden]{display:none!important}[data-rmj-active] > :not(:first-child):not(#rmj-config-form){display:none!important}[data-rmj-active] [role="tab"][data-active]:not(#rmj-config-tab){border-color:transparent;color:inherit}[data-rmj-active] #rmj-config-tab{border-bottom:2px solid #228be6;color:#228be6}';
    editor.append(styling);
    function select(value) {
        active = value;
        form.hidden = !value;
        tab.setAttribute('aria-selected', String(value));
        form.style.setProperty('display', value ? 'block' : 'none', 'important');
        for (const panel of root.querySelectorAll('[role="tabpanel"]')) {
            if (panel !== form) {
                if (value) panel.style.setProperty('display', 'none', 'important');
                else panel.style.removeProperty('display');
            }
        }
        if (value) root.setAttribute('data-rmj-active', '');
        else root.removeAttribute('data-rmj-active');
    }
    function mount() {
        const list = editor.querySelector('[role="tablist"]');
        if (!list) return;
        root = list.closest('.mantine-Tabs-root') || list.parentElement.parentElement;
        const nativeTabs = Array.from(list.querySelectorAll('[role="tab"]')).filter(item => item !== tab);
        if (nativeTabs.length < 2) return;
        if (tab.parentElement !== list) {
            tab.className = nativeTabs[0].className;
            list.insertBefore(tab, nativeTabs[1]);
        }
        if (form.parentElement !== root) root.append(form);
    }
    tab.addEventListener('click', () => select(true));
    editor.addEventListener('click', event => {
        const nativeTab = event.target.closest('[role="tab"]');
        if (active && nativeTab && nativeTab !== tab) select(false);
    }, true);
    tab.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const tabs = Array.from(tab.parentElement.querySelectorAll('[role="tab"]')).filter(item => !item.disabled);
        const index = tabs.indexOf(tab);
        const next = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs[tabs.length - 1] : tabs[(index + (event.key === 'ArrowLeft' ? -1 : 1) + tabs.length) % tabs.length];
        next.focus(); next.click();
    });
    const observer = new MutationObserver(mount);
    observer.observe(editor, { childList: true, subtree: true });
    window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
    mount();
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
        editor.style.display = '';
        target.required = rmj;
        status.style.display = 'none';
    }
    async function persist() {
        const enabled = mode.value === 'rmj';
        if (enabled && (!extract(true) || !target.reportValidity())) return;
        save.disabled = true;
        try {
            await request.post(data.endpoint, { csrf: data.csrf, mode: enabled ? 'rmj' : 'default', platform: platform.value, target: target.value });
            Notification.success('RMJ 设置已保存');
            save.disabled = false;
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
