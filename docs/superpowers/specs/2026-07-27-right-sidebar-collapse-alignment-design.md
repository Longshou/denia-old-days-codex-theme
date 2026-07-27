# 原生右侧栏收起时的任务主栏平滑对齐

## 问题

任务页关闭原生右侧栏时，Codex 会先动画收窄右侧栏，再更新可观测的侧栏布局状态。当前主题只在
`data-denia-sidebar-state="closed"` 后应用美术栏预留边距，因此主栏会经历两个阶段：

1. 原生右侧栏宽度逐步归零，Codex 原生 `mx-auto` 让主栏持续向右移动。
2. 侧栏检测最终变为 `closed`，主题边距突然接管，主栏弹回美术栏左侧的目标位置。

实测收起过程中，侧栏按钮已先变为关闭，但几何检测暂时返回 `unknown`。这段过渡窗口约为
350 毫秒，主栏最远比最终位置向右偏移约 151 像素。

## 根因

- 运行时只向根节点暴露了几何检测结果 `data-denia-sidebar-state`，没有暴露原生按钮的即时状态。
- 主题的闭合态边距基于临时缩窄中的父元素百分比计算，无法在过渡阶段稳定指向最终位置。
- CSS 直到几何检测确认 `closed` 才接管，错过了侧栏开始收起的时机。

## 设计

### 状态信号

运行时把现有的原生按钮检测结果同步到根节点：

```text
data-denia-sidebar-toggle-state="open|closed|unknown"
```

侧栏收起期间的可信组合为：

```text
sidebar-state=unknown
sidebar-toggle-state=closed
summary-state=closed
bottom-panel-state=closed
```

只有该组合提前启用主栏对齐。展开侧栏时按钮状态为 `open`，不会命中这条规则，继续使用 Codex
原生展开动画。

### 稳定目标位置

`.thread-scroll-container` 本身会随着原生侧栏收窄，直接使用 `100cqw` 仍会让目标边距变化。
运行时在正常刷新时记录完整主区域宽度，并扣除滚动条预留空间：

```css
--denia-thread-content-width: <stable content width>;
```

关闭过渡和最终闭合态都使用同一个快照；快照尚未建立时才回退到 `100cqw`：

```css
max(
  16px,
  calc(
    (
      var(--denia-thread-content-width, 100cqw)
      - var(--thread-content-max-width)
      - var(--denia-state-rail-width)
    ) / 2
  )
)
```

过渡态和最终闭合态使用同一公式，避免状态从 `unknown` 切换为 `closed` 时再次跳动。

### 动画

`margin-inline-start` 的原生起点是 `auto`，无法直接与长度值插值。直接增加 margin transition
会先跳到最小边距，再从错误位置缓动。因此运行时复用已有的面板几何检测，把最后一次可信的原生
侧栏宽度保存为：

```css
--denia-native-sidebar-width: <measured width>;
```

收起状态生效时，布局边距立即切到最终值，同时用 `translate` 抵消新旧侧栏预留宽度之差：

```css
from {
  translate: calc(
    (var(--denia-state-rail-width) - var(--denia-native-sidebar-width)) / 2
  ) 0;
}
to {
  translate: 0 0;
}
```

主栏原生样式带有 `transition: all`，会重新把边距从最小值插值一次，因此收起选择器同时设置
`transition: none !important`，只在该精确状态下关闭通配过渡。

动画时长为 160 毫秒，缓动为 `cubic-bezier(.22, 1, .36, 1)`。原生 toggle 属性变化由
MutationObserver 在浏览器绘制前同步到根节点，避免额外等待一帧。动画只移动主栏到最终目标，
不修改原生侧栏宽度、主栏宽度或输入框尺寸，也不新增逐帧 DOM 测量。

### 清理

正常清理和 loader 的兜底清理都必须删除新增的根节点 marker、侧栏宽度快照与任务主栏宽度快照，
避免主题卸载后遗留状态。

## 测试

- 运行时测试验证可见侧栏从按钮 `open` 切到 `closed`、面板仍可见时：
  - 几何状态保持 `unknown`。
  - `toggleState` 和根节点 marker 已立即变为 `closed`。
  - marker 在下一动画帧之前完成同步。
  - 最后一次可信的原生侧栏宽度已保存。
  - 完整任务主栏宽度已保存，且不跟随侧栏收窄。
- CSS 测试验证：
  - 收起过渡选择器只命中 `unknown + closed toggle + closed work surfaces`。
  - 过渡态和闭合态都使用稳定宽度快照的同一目标公式。
  - `translate` 起点准确抵消原生侧栏与美术栏的宽度差。
  - 过渡时长和缓动固定为 160 毫秒。
  - 不增加其他任务主栏布局覆盖。
- 清理测试验证正常与兜底路径都移除新增 marker 与两个宽度快照。
- 实机探针同时复测收起与展开：
  - 收起期间不再先越过最终位置再弹回。
  - 展开仍由 Codex 原生动画完成。
  - 最终开、关状态和主栏位置正确。

## 验收标准

- 原生右侧栏收起后，主栏从原生打开位置一次连续移动到美术栏左侧的最终位置。
- `unknown` 到 `closed` 的状态交接没有可见跳变。
- 置顶摘要开关行为保持现状。
- 右侧栏展开动画、主栏宽度、输入框和任务美术栏不受影响。
- Sidecar 全量验证和实机时序探针通过。
