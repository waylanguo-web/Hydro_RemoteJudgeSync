import { addPage, NamedPage, request, Notification } from '@hydrooj/ui-default';

addPage(new NamedPage('problem_config', () => {
    const data = window.UiContext.rmjConfig;
    const editor = document.getElementById('ProblemConfig');
    if (!data || !editor || document.getElementById('rmj-config-extension')) return;
    const panel = document.createElement('div');
    panel.id = 'rmj-config-extension';
    panel.className = 'section__body typo';
    // Static markup only. Dynamic problem values are assigned through DOM properties.
    panel.innerHTML = `<h2>RMJ 题型扩展</h2>
<label>题目类型 <select class="select" name="rmj-mode">
<option value="native">Hydro 原生题型（使用下方原生编辑器）</option>
<option value="rmj">RMJ · Codeforces 远程 AC 验证</option>
</select></label>
<div data-rmj-fields><label>CF 原题 <input class="textbox" name="rmj-target" placeholder="CF2276A 或 CF 官方题目链接"></label>
<p>仅验证已绑定账号的历史 AC，无需提交代码。初版仅支持日常练习。</p></div>
<p data-rmj-native>使用原生编辑器可设置普通题、交互题、提交答案等题型。</p>
<button type="button" class="button primary" data-rmj-save>保存 RMJ 配置</button>
<p data-rmj-status role="status"></p>`;
    editor.before(panel);
    const mode = panel.querySelector('[name="rmj-mode"]');
    const target = panel.querySelector('[name="rmj-target"]');
    const save = panel.querySelector('[data-rmj-save]');
    const status = panel.querySelector('[data-rmj-status]');
    mode.value = data.type === 'rmj' ? 'rmj' : 'native';
    target.value = data.target;
    function update() {
        const rmj = mode.value === 'rmj';
        panel.querySelector('[data-rmj-fields]').hidden = !rmj;
        panel.querySelector('[data-rmj-native]').hidden = rmj;
        // An RMJ config is outside Hydro's core schema. Use this extension for it.
        editor.style.display = rmj || data.type === 'rmj' ? 'none' : '';
        save.hidden = !rmj && data.type !== 'rmj';
        save.textContent = rmj ? '保存 RMJ 配置' : '切换为普通题并打开原生编辑器';
        target.required = rmj;
        status.textContent = !rmj && data.type === 'rmj' ? '保存后切换为普通题，再使用原生编辑器继续配置。' : '';
    }
    mode.addEventListener('change', update);
    save.addEventListener('click', async () => {
        if (mode.value === 'rmj' && !target.reportValidity()) return;
        save.disabled = true;
        try {
            await request.post(data.endpoint, { csrf: data.csrf, mode: mode.value === 'rmj' ? 'rmj' : 'default', target: target.value });
            Notification.success('评测设置已保存');
            window.location.reload();
        } catch (e) {
            status.textContent = e.message || '保存失败，请稍后重试。';
            Notification.error(status.textContent);
            save.disabled = false;
        }
    });
    update();
}));
