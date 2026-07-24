# 错误态、首页卡片稳定性与旧项目清理设计

## 目标

本轮只解决三个已复现问题：

1. 无结构化错误属性的明确命令失败助手卡也能触发 `error` 和 `taskError`。
2. 首页原生建议按钮在输入、清空或重挂载时，四卡区域不再导致下方工作区跳动。
3. 保全唯一美术与旧 Git 历史后，清理旧主题副本
   `/Users/bytedance/ByteDance/workspace/denia-old-days-codex-theme`。

保持当前首页、右侧栏、输入框、审批卡和五态人物映射不变。

## 已确认根因

### 错误态

`errorVisible()` 目前只读取结构化 `data-state/data-status/data-testid` 和
`role="alert"`。截图中的结果卡只是普通
`[data-content-search-unit-key$=":assistant"]`，正文虽包含
`command not found` 和非零退出码，仍会落入 `complete`。

### 首页卡片

`ensureSuggestionDeck()` 在原生建议按钮数量不等于 4 时立即删除主题 deck。
主题 deck 是正常文档流中的唯一卡片高度，因此输入首字符或清空时下方工作区会
立即上移或下移。

真实运行还存在稳定页面约 124 次 refresh/秒的自触发循环。Observer 监听
`class/style/data-*`，而 refresh 又重复写 root dataset、人物 rail dataset 和
style，导致扩展消费自己的 mutation。

### 旧项目

旧主题副本与当前仓库是两个不同 Git 历史。旧副本无 remote，主工作树 clean，
并含一个 `official-art-revision` linked worktree。其 8 张官方源图已与当前
`art/` 字节一致，不需要重复迁移。

## 错误态检测

保留现有结构化检测，再增加保守 fallback：

- 只检查 DOM 顺序中的最新助手单元。
- 只检查该单元中的独立短段落，规范化后不超过 240 字符。
- 必须以 `测试错误已触发`、`命令执行失败` 或 `command failed` 加冒号开头。
- 必须包含 `command not found` 或 `命令未找到`。
- 必须包含十进制非零退出码：
  `退出码为 N`、`exit code N` 或 `exited with status N`。

不得扫描用户消息、全部历史助手、代码块或仅包含 `error/错误` 的普通说明。
最新正常助手出现后，旧失败助手不得让错误态粘住。

Observer 的 attribute filter 增加 `data-testid`，VM childList 测试覆盖
“插入失败助手 -> 一次 rAF -> error/taskError”。

## 首页建议卡稳定槽

首页 Hero 后创建一个 owned、无语义、无交互的
`#denia-old-days-ds-suggestion-slot`：

- 4 个真实原生建议动作齐全时，主题 deck 是 slot 的唯一子节点。
- 原生动作不足 4 个时立即删除 deck、恢复原生节点 class；slot 保持为空，
  不包含 button、role、label、tab stop 或 pointer target。
- slot 保存最近一次有效 deck 的实测 block height，使下方工作区的 y 坐标不变。
- deck 的外部间距由 slot 承担，避免 margin collapse。
- deck 恢复后仍代理当前四个原生动作，不缓存旧按钮引用。
- 离开首页或 cleanup 时删除 slot 并清空测量状态。

不采用延时删除，不显示 disabled 假卡，不给空 slot 添加骨架或提示文字。

## Observer 稳定性

使用两层防护：

1. 所有可观察写入 compare-before-write，包括 root dataset、rail dataset、
   opacity/style 和状态 class。
2. MutationObserver 只在记录含应用原生变化时调度 refresh：
   - owned 节点及其后代的 childList/attribute mutation 忽略；
   - 仅由 `denia-old-days-ds-*` token 变化产生的 class mutation 忽略；
   - 原生节点与扩展 mutation 同批出现时仍处理原生记录。

不得通过 refresh 期间 disconnect observer 丢弃原生变化。

稳定页面 2 秒内不得出现逐帧增长；验收阈值为无用户操作时
`refreshes` 增量不大于 4。

## 美术迁移

迁入当前仓库但不进入运行包：

- `art/archive/legacy-main-7851e38/background.svg`
- `art/archive/legacy-main-7851e38/hero.svg`
- `art/archive/legacy-main-7851e38/task-preview.svg`
- `art/reference/visual-library-2026-07-23/production-ready/dark-stage-complete.jpg`
- `art/reference/visual-library-2026-07-23/production-ready/old-days-half-face-clean.jpg`

两个目录各自包含 `PROVENANCE.md`，记录旧路径、SHA-256、审计日期和
“不得自动打包”边界。8 张已重复官方图不再次复制。

## 旧项目清理

清理目标仅限：

`/Users/bytedance/ByteDance/workspace/denia-old-days-codex-theme`

执行顺序：

1. 校验上述 5 个迁移文件 SHA-256。
2. 导出旧仓库全部 refs 到
   `/Users/bytedance/Archives/denia-old-days-codex-theme-legacy-7851e38.bundle`，
   并运行 `git bundle verify`。
3. 使用旧仓库自己的 `git worktree remove` 移除
   `.worktrees/official-art-revision`。
4. 确认旧主树 clean，且当前构建/LaunchAgent 无绝对路径引用。
5. 将旧主树移动到
   `/Users/bytedance/.Trash/denia-old-days-codex-theme-legacy-7851e38-20260724`。

这是可恢复清理，不使用 `rm -rf`。

明确不清理：

- `/Users/bytedance/ByteDance/workspace/Codex-Dream-Skin`
- `/Users/bytedance/ByteDance/workspace/kaboo`
- `/Users/bytedance/ByteDance/workspace/denia-visual-library`
- 当前 `/Users/bytedance/workspace/denia-old-days-codex-theme`

## 测试与验收

### 错误态

- 截图原文触发 `error/taskError`。
- 退出码 0、普通 error 说明、用户消息、旧历史失败均不触发。
- 结构化 error、approval、working、complete 现有优先级不回归。

### 卡片与 observer

- `[4] -> [0/3] -> [4]` 中 slot 高度保持，失源时 slot 无按钮。
- deck 恢复后恰好 4 个代理，顺序、disabled 与 click 映射正确。
- working 与 home 稳定刷新不产生 extension-only 后续 mutation。
- cleanup 移除 slot、监听器、dataset 和 inline 测量。
- live verify 返回 slot 几何与 refresh 稳定性结果。

### 资源与清理

- 5 个迁移文件与审计 SHA-256 一致。
- 归档资源不出现在 Sidecar manifest、renderer input 或 release ZIP。
- Git bundle 可验证。
- 旧项目原路径不存在，废纸篓目标存在且可恢复。
- 三个依赖项目与当前仓库仍存在且未被修改。

## 不在范围

- 不扩大错误关键词到一般自然语言。
- 不改变错误、审批、工作、完成的人物图片或 opacity。
- 不重排 Hero、工作区或 composer。
- 不删除视觉研究库、Dream Skin 或 Kaboo。
- 不上传、推送、建 PR、发布 Registry 或重启 Codex。
