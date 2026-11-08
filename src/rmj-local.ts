export function remoteTarget(doc: any) {
    return doc?.rmjTarget || (doc?.config?.type === 'rmj'
        ? { platform: doc.config.subType || 'codeforces', target: doc.config.target }
        : null);
}

export async function localStatus(doc: any, yaml: any, common: any, readYamlCases: any) {
    const names = (doc.data || []).map((file: any) => file.name);
    try {
        const cfg = typeof doc.config === 'string' ? yaml.load(doc.config) || {} : { ...doc.config };
        if (cfg.type === 'rmj') return '旧题配置需要转换，请在评测设置中保存一次。';
        if (!['default', 'interactive', 'communication', undefined].includes(cfg.type)) return '当前本地题型不支持代码评测。';
        const check = (name: string) => {
            if (name !== '/dev/null' && !names.includes(name)) throw new Error('缺少测试文件：' + name);
            return name;
        };
        const parsed = await readYamlCases(cfg, check);
        const groups = parsed.subtasks?.length ? parsed.subtasks : common.readSubtasksFromFiles(names, parsed);
        if (!groups.some((group: any) => group.cases?.length)) return '未找到可用的测试用例。';
        common.normalizeSubtasks(groups, check, parsed.time, parsed.memory);
        return '';
    } catch (error) {
        return error instanceof Error ? error.message : '本地测试数据配置无效。';
    }
}
