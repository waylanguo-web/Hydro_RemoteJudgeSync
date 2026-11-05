# Hydro RemoteJudgeSync

面向 HydroOJ 的远程 AC 同步插件（RMJ）。学生自行在 Codeforces、AtCoder、洛谷提交，Hydro 展示翻译题面、原题链接，并计划同步绑定账号的通过状态。

**当前已实现 CF 账号绑定初版，完整 RMJ 题目与成绩同步尚未实现。** 通过 Hydro 设置页钩子添加 CF 名、绑定与解绑入口，不修改 Hydro 原生成绩。

## 本地开发

需要 Node.js >=22。

```sh
npm ci
npm run typecheck
npm test
npm run build
```

`src/index.ts` 导出 Hydro 插件入口 `apply`，构建输出为 `dist/`。目前仅以 Hydro 5 为目标；实际站点版本及接口仍需部署前核对。不要在生产环境把此骨架当成完整评测插件。

## 已初始化

- TypeScript 严格模式、构建和 GitHub Actions CI。
- 平台账号、远端题目、AC 提交的类型定义。
- 支持游标分页的平台适配器契约。
- 独立通过判断，使用外站提交时间，支持包含边界的作业时间窗口。

## 开发路线

1. 确认目标 Hydro 版本，接入数据库、权限和账号页面。
2. 账号所有权验证、平台账号唯一性约束、改绑审计。未认证账号不可用于正式成绩。
3. CF 官方接口和 AtCoder Problems 适配器：完整分页、限流、超时、重试、增量同步和缓存。
4. RMJ 元数据、原题链接、同步按钮和独立进度页面。
5. 验证洛谷公开数据可用性后，再实现实验性适配器。
6. 单独验证 Hydro 原生记录、作业和统计接口后再做成绩集成。

不收集外站密码、Cookie 或 Session。网络异常不等于未通过；第三方延迟不改变远端 AC 时间。RMJ 只汇总成绩，不能代替无法访问外站的学生提交代码。

## 参考

- [Hydro 源码](https://github.com/hydro-dev/Hydro)
- [Codeforces API](https://codeforces.com/apiHelp)
- [AtCoder Problems API](https://github.com/kenkoooo/AtCoderProblems/blob/master/doc/api.md)

许可证待仓库所有者确定，当前未授予额外开源许可。

## CF 绑定测试与安装

```sh
npm ci
npm test
npm run typecheck
npm run build
hydrooj addon add /absolute/path/to/Hydro_RemoteJudgeSync
```

然后按站点现有方式重启 Hydro，访问 `/home/settings/account`。插件依赖 Hydro 5 的默认 UI 模板；自定义主题需提供 `home_settings.html` 和 `layout/home_base.html`。当前以官方源码的 `HomeSettings` 响应钩子为目标，尚未在真实站点联调。

绑定流程：输入 CF 用户名 → 官方 API 检查存在性 → 从通过人数不超过 1000 的非交互编程题中随机抽题 → 在 10 分钟内以 **Kotlin 2.2.0** 提交 `fun main() { val rmj: Int = "RMJ_BINDING" }` 获得 CE → 回到页面点击检测。重新开始会替换旧挑战，超时必须重新发起。时间以服务器为准，请保持服务器时钟准确。

账号显示来自插件独立 MongoDB 集合，不接受设置页直接编辑；全站同一 CF 账号仅允许绑定一名 Hydro 用户。数据库唯一索引处理并发重复绑定。绑定和解绑仅允许登录用户操作，POST 另校验会话 CSRF 令牌。账号接口有请求频率限制。

CF 查询设有超时、单进程串行限流及题库缓存。多进程部署时各进程的限流独立，生产部署应增加共享限流或统一出口。CF API 不可访问会显示错误，不会误判验证通过。

自动测试使用模拟 API，不向外站制造提交。真实验收：检查初始“未绑定”；不存在用户名报错；按挑战要求提交后绑定；刷新设置页显示规范 CF 名；解绑后恢复“未绑定”；重复绑定、旧提交、错误语言、超时均不能验证成功。真实 CE 提交需要由账号所有者操作。
