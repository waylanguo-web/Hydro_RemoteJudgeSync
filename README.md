# Hydro RemoteJudgeSync

面向 HydroOJ 的远程 AC 同步插件（RMJ）。学生自行在 Codeforces、AtCoder、洛谷提交，Hydro 展示翻译题面、原题链接，并计划同步绑定账号的通过状态。

**当前是开发初始化版本，尚不能部署为可用的 RMJ 功能。** 插件入口不注册路由、不请求外站、不写入成绩。

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
