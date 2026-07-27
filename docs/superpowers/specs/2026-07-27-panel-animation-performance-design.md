# 原生面板切换性能修复

## 问题

原生右侧栏和底部面板切换时出现连续掉帧。底部面板打开的中间帧会停留在警告条已出现、
终端主体尚未完成布局的状态。

## 诊断

### 输入框误识别

`findComposer()` 先查找页面中的任意 `textarea`。底部终端创建
`.xterm-helper-textarea` 后，该节点会先于任务输入区被选中，随后 `.xterm-screen` 被添加
`denia-old-days-ds-composer`。

终端因此错误套用输入框的背景、阴影和模糊样式，也会被 `decorateComposer()` 反复扫描。

### 动画 style 变更触发完整刷新

当前 MutationObserver 观察 `style` 属性。原生面板通过逐帧修改内联样式完成动画，每批变更都会
进入 `scheduleRefresh()`。实测 900 毫秒内：

- 右侧栏打开、关闭触发 17～23 次完整刷新。
- 底部面板打开、关闭触发 6～23 次完整刷新。
- 右侧栏的 class/style 变更中，style 占 67/77 和 151/159。
- 底部面板的 class/style 变更中，style 占 205/222 和 108/111。

禁用主题运行时后，完整刷新为 0。底部终端首次初始化仍有约 200 毫秒原生长任务，属于 Codex
自身成本；本次目标是不再由主题放大。

## 设计

### 第一阶段：修正输入框识别

输入框识别按以下优先级执行：

1. 可见的 `.composer-surface-chrome`。
2. 不位于 `.xterm`、`[id^="terminal-panel-"]`、`[role="tabpanel"]`、对话框、侧栏或导航内的
   `textarea` / `[contenteditable="true"]`。
3. 第二步的输入节点只能回溯到 `.composer-surface-chrome` 或 `form`，不再使用任意两层父节点。

终端节点不得收到 composer、send 或 attachment 主题类。无
`.composer-surface-chrome` 的表单测试夹具继续通过 `form` 回退路径工作。

第一阶段安装后重新运行面板性能探针。若任一面板方向在 900 毫秒内仍超过 5 次完整刷新，且
style 变更占 class/style 变更的 50% 以上，进入第二阶段。

### 第二阶段：合并动画期间的刷新

MutationObserver 继续观察 `style`，保留对纯内联样式状态变化的兼容性，但不再逐帧刷新：

- 过滤主题自身和终端内部变更后，若批次只剩 `style` 属性变更，则使用 80 毫秒尾部防抖。
- 新的 style 变更重置计时器；动画停止 80 毫秒后执行一次普通刷新。
- 没有动画计时器时，childList、class、ARIA、data 属性和 disabled 等语义变更仍在下一动画帧刷新。
- 若同一批次包含原生面板开关状态，或 style 动画计时器已经存在，夹杂的语义变更也并入尾部刷新，
  避免在动画中途重新执行完整 DOM 扫描。
- 侧栏、置顶摘要和底部面板按钮状态在 MutationObserver 回调中立即同步，不等待完整刷新。
- 正常 cleanup 必须取消 style 防抖计时器。

终端 churn 过滤范围扩展到 `.xterm` 和 `[id^="terminal-panel-"]`，避免终端内部挂载触发主题刷新。

复测还发现，主题刷新会触发 Codex 临时挂载并立即移除一个不可见的编辑器颜色解析节点：
`<div style="display: none; background-color: var(--color-token-editor-background)">`。该节点会反向触发
下一次主题刷新，形成反馈环。只过滤同时满足空 `div`、无 id/class/text/children、精确 display 和
background-color 值的探针节点；普通 body 子节点仍按语义变更处理。

## 验收

- 打开底部面板时，`.xterm` 子树中不存在 `denia-old-days-ds-composer`。
- 重复 style 变更不安排逐帧 refresh，只在静止 80 毫秒后刷新一次。
- 非动画期的语义变更仍在下一动画帧刷新；动画期语义变更并入同一个尾部刷新。
- 侧栏、置顶摘要和底部面板 marker 在下一帧前更新。
- 面板四个开关方向每 900 毫秒完整刷新不超过 5 次。
- 与禁用主题的基线相比，主题不额外增加超过 1 个 50 毫秒以上长任务。
- 侧边栏平滑对齐、置顶摘要居中、输入框样式和终端交互不回退。
