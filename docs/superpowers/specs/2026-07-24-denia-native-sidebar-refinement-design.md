# 达妮娅原生右侧栏优化设计

## 目标

优化 Codex 原生右侧系统栏在达妮娅主题下的视觉表现，同时确保原生工作流始终优先：

- 首页右侧栏不再像一块孤立白板。
- 任务页右侧栏不再被人物图穿透，文字、图标、缩略图和状态都能立即辨认。
- 不改变原生分栏、侧栏宽度、滚动、按钮、快捷键、审批卡和输入框几何。
- 不主动打开或关闭侧栏。
- 所有主题改动可清理、可降级，不依赖单一易变 class。

本设计采用视觉稿中的暖纸、青灰分界、虹彩泡泡和分组面板语言，但不会机械复刻生成图中的额外文字或重排原生条目。

## 设计判断

这是保留现有品牌的产品界面优化：

- `DESIGN_VARIANCE: 5`：有品牌气质，但不制造实验性布局。
- `MOTION_INTENSITY: 3`：只保留打开、关闭和状态变化的短过渡。
- `VISUAL_DENSITY: 5`：保持 Codex 原生工具密度，不把系统栏改成展示页。

视觉层级固定为：

1. 原生交互和文字；
2. 高不透明功能表面；
3. 暖纸、线条和状态色；
4. 人物美术。

人物不能越过前三层。

## 状态矩阵

| 路由 | 右侧栏 | 原生侧栏 | 人物状态美术 |
| --- | --- | --- | --- |
| 首页 | 关闭 | 不处理 | 首页 Hero 自己承担品牌表达 |
| 首页 | 打开且高置信识别 | 暖纸表面、青灰分界、轻纹理、功能行分组 | 不显示 |
| 任务页 | 关闭 | 不处理 | 保留当前状态人物栏 |
| 任务页 | 打开且高置信识别 | 暖纸表面、状态色、功能卡高不透明 | 隐藏固定人物栏 |
| 任意页面 | 检测不确定 | 不触碰原生节点 | 隐藏人物栏，安全降级 |
| 任意页面 | 宽度小于 920px | 只保留原生界面 | 隐藏人物栏 |

右侧栏打开时不继续显示完整人物图。任务状态通过侧栏左缘、顶部渐变和虹彩泡泡色表达：

- `staged`：浅金和低饱和青；
- `working`：晶蓝和青；
- `approval`：克制紫；
- `error`：深粉红；
- `complete`：浅金和暖粉。

## 原生侧栏识别

### 三态结果

运行时返回：

- `open`：高置信确认右侧栏真实可见；
- `closed`：高置信确认已关闭；
- `unknown`：证据不足或互相冲突。

`unknown` 必须安全降级：不标记原生节点，不显示人物栏。

### 识别证据

优先使用以下证据组合，而不是直接选择第一个 `aside` 或 `nav`：

1. 可见原生控制按钮的 `aria-controls` 和 `aria-expanded`；
2. 右缘采样点 `elementFromPoint()` 命中的原生节点及其祖先；
3. 候选节点的 `getBoundingClientRect()`；
4. 候选矩形是否贴近视口右缘，并位于 `main` 的右侧；
5. 候选内部是否包含至少两个可见原生交互控件。

高置信 `open` 至少满足：

- 候选已连接、可见、尺寸大于零；
- 高度不小于 `max(240px, viewportHeight * 0.35)`；
- 右缘与视口右缘误差不大于 12px；
- 候选不属于 `main`、composer、dialog、alertdialog、menu、listbox、tooltip 或左侧导航；
- 中部采样点命中候选或其后代；
- 存在 `aria-controls` 直接关系，或存在至少两个可见交互控件。

`aria-expanded="true"` 但 panel 不可见时返回 `unknown`，不能返回 `open`。

### 生命周期

沿用单一 MutationObserver 和 rAF 合并刷新，额外监听：

- `aria-expanded`
- `aria-controls`
- `aria-hidden`
- `hidden`
- `style`
- `class`
- window `resize`
- `visualViewport.resize`，如果可用

关闭侧栏或检测变为 `unknown` 时立即移除侧栏 class 并隐藏人物栏。清理和重装时必须恢复所有 touched 原生节点。

## DOM 与样式架构

### 原生节点

不克隆、不包裹、不移动原生节点，只允许添加可清理 class：

- panel：`.denia-old-days-ds-native-right-sidebar`
- 功能分组：`.denia-old-days-ds-native-sidebar-group`
- 功能行：`.denia-old-days-ds-native-sidebar-row`

功能分组只选择满足以下条件的可见 panel 后代：

- 包含至少一个原生交互控件或多个可见内容行；
- 宽度不小于 panel 内容宽度的 60%；
- 不是 tooltip、dialog、menu、popover、toast；
- 不属于主题自有节点。

功能行只选择 panel 内现有的可见 `button`、链接或其最小点击祖先。不得向 panel 内所有 `div` 广泛加 class。

### Paint-only 白名单

对原生 panel、group 和 row 只能修改：

- `background` / `background-color`
- `background-image`
- `border-color`
- `border-radius`
- `box-shadow`
- `color`
- `outline-color`
- `transition`，且只允许过渡 `background-color`、`border-color`、`box-shadow`、`color`
- `transition-duration`

不得修改：

- `position`、`z-index`
- `display`、`visibility`、整节点 `opacity`
- `width`、`height`、min/max size
- `margin`、`padding`
- `inset`、`transform`
- `overflow`、滚动行为
- `grid`、`flex`、`order`
- `pointer-events`、`user-select`

边界线使用 inset box-shadow，避免新增 border 宽度改变盒模型。

### 首页视觉

首页右侧栏采用：

- `rgba(255, 251, 247, .98)` 暖白实底；
- 左侧 1px 青灰 inset 分界；
- 顶部低对比粉青径向渐变；
- 很浅的水平手账线纹；
- 原生功能行使用半透明暖白表面和轻微青色高亮；
- 不添加人物、宣传文字、Logo 或额外按钮。

首页的丰富感来自材质、色块和分组，不来自插入新的品牌卡。

### 任务视觉

任务页右侧栏采用同一暖纸表面，但加入当前状态色：

- panel 背景不透明度不低于 `.97`；
- group 背景不透明度不低于 `.98`；
- 原生审批、权限、确认区域保持实色或 `.99`；
- 状态色只用于左缘 inset 线、顶部小范围渐变和低对比泡泡纹；
- 禁止人物图作为 panel 或 group 的 background。

右侧栏打开时，`.denia-old-days-ds-state-art` 必须隐藏。右侧栏关闭且任务宽度足够时，当前人物状态栏按现有映射继续工作。

### 原有 stacking 修正

删除 task `main` 的人工 `z-index: 3` 保护。主题不得通过改变整个 `main` stacking context 来压住人物图。

## 运行数据

根节点增加：

- `data-denia-sidebar-state="open|closed|unknown"`
- `data-denia-sidebar-confidence="high|none"`

公开运行状态增加不含节点和 URL 的诊断：

```js
sidebar: {
  state: "open",
  confidence: "high",
  anchorKind: "aria-controls|right-edge-hit|none",
  panelVisible: true,
  skinApplied: true,
  groupCount: 2,
  rowCount: 4,
}
```

不得把原生 DOM 节点、Blob URL 或人物图片 URL 放入公开状态。

## 动效与可访问性

- 侧栏表面仅在颜色和阴影上做 180-240ms 过渡。
- 不动画 width、height、position、inset 或 transform。
- `prefers-reduced-motion: reduce` 下取消过渡。
- `prefers-reduced-transparency: reduce` 下使用完全不透明暖白底。
- 原生焦点、按钮命中区、键盘导航、快捷键和滚动完全保留。
- 主题自有装饰继续 `aria-hidden="true"`、`pointer-events:none`。

## 错误与降级

- 找不到高置信右侧栏：不触碰原生节点，隐藏人物栏。
- 侧栏正在动画或几何冲突：状态为 `unknown`，等待下一次刷新。
- panel 被重新挂载：清理旧节点 class，再标记新节点。
- 原生结构不包含可安全识别的 group 或 row：只美化 panel 外壳。
- 小于 920px：不显示人物栏，不额外调整原生布局。

## 测试要求

### VM 行为

至少覆盖：

1. `aria-controls` 指向可见右侧 panel，几何和 hit-test 通过，结果为 `open/high`。
2. `aria-expanded=false` 且 panel 隐藏，结果为 `closed`。
3. `aria-expanded=true` 但 panel 零尺寸或离屏，结果为 `unknown`。
4. 只有左侧 `nav/aside` 时不得误判。
5. 右上 toast、dialog、menu 不得误判。
6. 没有稳定 class，但右缘 hit-test 和交互控件通过时仍能识别。
7. 多候选时，直接 `aria-controls` 关系优先。
8. 打开、关闭、重新挂载时旧 class 完整清理。
9. 首页 open 时只应用暖纸 class，人物 rail 隐藏。
10. 任务 open 时 panel/group 为高不透明表面，人物 rail 隐藏。
11. closed 任务页恢复当前人物 rail。
12. 小于 920px 和 `unknown` 时人物隐藏。
13. 注入前后 toggle、panel、main、composer、approval card 的几何和交互属性不变。
14. cleanup 后原生 class、root dataset 和监听器完整清理。

### 静态断言

- 禁止固定人物 rail 在侧栏 open 时可见。
- 禁止 task `main` 设置 z-index。
- panel/group/row selector 只能使用 paint-only 白名单。
- 禁止通用 `aside`、`nav` CSS 直接施加主题。
- 检测实现必须包含 `aria-controls`、`aria-expanded`、`getBoundingClientRect()` 和 `elementFromPoint()`。
- 主题不得调用原生 sidebar toggle 的 `.click()`。
- 主题不得 clone、wrap、reparent 原生 panel 或功能行。

### Live verify

在现有结果中增加：

```json
{
  "sidebar": {
    "state": "open|closed|unknown",
    "confidence": "high|none",
    "panelVisible": true,
    "skinApplied": true,
    "groupCount": 2,
    "rowCount": 4,
    "artVisible": false,
    "homeNoCharacterPass": true,
    "taskReadabilityPass": true,
    "nativeGeometryPass": true,
    "toggleHitTargetPass": true
  }
}
```

`open` 时要求 skin、可读性、原生几何和 toggle 命中全部通过；`closed` 时要求无遗留 skin；`unknown` 时要求无人物、无原生节点修改。

## 不在本次范围

- 不修改人物素材、裁切或状态映射。
- 不重排原生功能条目。
- 不给右侧栏增加可点击品牌入口。
- 不修改左侧导航设计。
- 不改变首页 Hero、建议卡、输入区和任务内容卡。
- 不上传、推送、创建 PR 或发布 Registry。
- 不主动重启 Codex。
