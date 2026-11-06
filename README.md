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

## AtCoder 账号绑定

账号设置页新增 AtCoder 名及绑定、解绑入口，绑定页面为 `/home/rmj/atcoder`。
输入用户名后生成有效期 10 分钟的一次性验证码，将 AtCoder 个人资料的 Affiliation（所属）字段完整替换为验证码并保存，然后返回检测。成功后可恢复原内容。
读取官方公开个人资料，不使用第三方 CE 记录，无需提供外站密码或 Cookie。验证码仅核验所属字段；每次重新发起会替换旧挑战。同一 AtCoder 账号全站只能绑定一位学员。AtCoder 无法访问、页面格式异常或超时均不会绑定成功。

## 洛谷账号绑定

账号设置页新增洛谷入口，绑定页面为 `/home/rmj/luogu`。输入数字 UID（非用户名），将公开个人介绍完整替换为一次性验证码，10 分钟内返回检测，绑定成功后可恢复原介绍。账号关联以 UID 为准，用户名仅用于显示。

当前读取官方公开主页的 `lentille-context` JSON 中 `data.user.introduction`，严格校验页面类型、状态与 UID，不在整个网页搜索验证码。此结构不是稳定的官方 API；访问受限或结构变化时会拒绝绑定并提示重试，不绕过验证码、不收集密码或 Cookie。支持重复发起、唯一性约束、解绑和会话 CSRF 校验。

## RMJ 题型（首版：CF 日常练习）

1. 新建普通题目，填写翻译题面并保存。
2. 进入题目的「评测设置」(`/p/题号/config`)，在右侧「评测方式」中选择 RMJ 并填写 CF 题号。
3. 填写 `CF4A`、`4:A` 或官方原题链接，保存后该题的 `config.yaml` 使用 `type: rmj`、`subType: codeforces` 和 `target: 4:A`。原有其他配置保留。
4. 学员打开题目点击「提交 · 检测 CF AC」，服务器使用已验证绑定账号查询历史提交，不接收代码。

找到指定题目的单人 AC 即以 100 分写入 Hydro 原生 Accepted 记录；完整查询后仍未找到则以 0 分记录未通过。历史 AC 有效。网络失败、扫描达到 100000 条上限但未查完、绑定/题目配置中途改变均报错，不生成错误的未通过记录。每位用户每分钟最多两次查询；CF 请求与绑定验证共享单进程串行限流。首次历史查询可能较慢。

记录正文及评测信息明确标记 RMJ 来源、绑定账号、远端提交 ID/时间和同步时间，不保存或转发外站代码。通过 Hydro 的 `JudgeResultCallbackContext.end` 更新原生题目状态、通过数和成绩事件，不直接改数据库 AC 标记。远端时间是审计信息，Hydro 记录创建时间为本次检测时间。

初版拒绝比赛和作业模式，不支持自测和本地重评。RMJ 控件通过 Hydro 前端插件 API 注入原生评测设置页，题面编辑页不做任何替换。普通题继续使用原生编辑器；RMJ 可在同页切换回普通题。旧 `/p/题号/rmj` 链接会跳转至评测设置。引用题暂不支持配置。卸载插件前请恢复题型，避免原生评测器处理 `rmj` 类型。恢复普通题时，在测试数据 config.yaml 中将 type 改回原值并移除 RMJ 的 subType 和 target。

RMJ 题目详情使用 Hydro 原生模板、标题信息栏和菜单，专用界面仅用于递交检测。评测方式控件位于评测设置右侧栏，普通题不显示额外保存或切换按钮。
