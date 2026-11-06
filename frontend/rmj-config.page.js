import { addPage, NamedPage, request, Notification } from '@hydrooj/ui-default';

addPage(new NamedPage('problem_config', () => {
    const data = window.UiContext.rmjConfig;
    const editor = document.getElementById('ProblemConfig');
    if (!data || !editor || document.getElementById('rmj-config-extension')) return;
    const panel = document.createElement('div');
    panel.id = 'rmj-config-extension';
    panel.className = 'section side';
    // Static markup only. Dynamic problem values are assigned through DOM properties.
    panel.innerHTML = `<div class="section__header"><h1 class="section__title">评测方式</h1></div>
<div class="section__body">
<select class="select" name="rmj-mode" aria-label="评测方式" style="width:100%">
<option value="native">本地评测（原生设置）</option>
<option value="rmj">RMJ · Codeforces</option>
</select>
<div data-rmj-fields style="margin-top:12px"><label>CF 原题 <input class="textbox" name="rmj-target" placeholder="CF2276A 或原题链接" style="width:100%"></label></div>
<button type="button" class="button primary" data-rmj-save style="margin-top:12px">保存</button>
<p data-rmj-status role="status" style="margin:8px 0 0"></p>
</div>`;
    const sidebar = editor.closest('.row')?.querySelector('.medium-3.columns');
    if (sidebar) sidebar.prepend(panel);
    else editor.before(panel);
    const mode = panel.querySelector('[name="rmj-mode"]');
    const target = panel.querySelector('[name="rmj-target"]');
    const save = panel.querySelector('[data-rmj-save]');
    const status = panel.querySelector('[data-rmj-status]');
    mode.value = data.type === 'rmj' ? 'rmj' : 'native';
    target.value = data.target;
    function update() {
        const rmj = mode.value === 'rmj';
        panel.querySelector('[data-rmj-fields]').style.display = rmj ? '' : 'none';
        // An RMJ config is outside Hydro's core schema. Use this extension for it.
        editor.style.display = rmj || data.type === 'rmj' ? 'none' : '';
        save.style.display = rmj || data.type === 'rmj' ? '' : 'none';
        save.textContent = rmj ? '保存' : '保存并切换为本地评测';
        target.required = rmj;
        status.textContent = '';
        status.style.display = 'none';
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
            status.style.display = '';
            Notification.error(status.textContent);
            save.disabled = false;
        }
    });
    update();
}));
