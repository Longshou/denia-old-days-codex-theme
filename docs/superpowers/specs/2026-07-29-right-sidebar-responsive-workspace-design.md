# 右侧栏响应式工作区设计

## 状态

- 用户已于 2026-07-29 批准直接实施，中途不设置确认节点。
- 窄栏继续使用 `denia-dark-form-smile-closeup.png`。
- 宽栏使用用户提供的 `image-1.jpg`。该文件与素材库的 `dark-stage-complete.jpg` 字节一致，SHA-256 为 `d312c86f21610d7d6b50b8d8fa9b9685ef4baa11d34c0ca72fd71a712bfa42ed`。

## 目标

让 Codex 原生右侧栏从约 `320px` 的常规宽度拖拽到全工作区宽度时，在拖拽阶段稳定遮盖画面，停止后按面板宽高比选择人物近景或完整舞台；同时消除快捷项首帧白闪、选项外框、底部输入框外溢焦点线和被侧栏压住的问题。

## 设计判断

Reading this as：保留 Codex 原生结构的高频工具界面定向重设计，人物素材明确存在，但宽栏仍然首先是可工作的输入区。

- `DESIGN_VARIANCE: 5`
- `MOTION_INTENSITY: 3`
- `VISUAL_DENSITY: 4`
- 模式：保守重绘
- 技术基础：现有 Sidecar、原生 CSS、对象 URL 资源管线和 CDP 热安装

## 当前问题

### 竖图在宽栏中失真

右侧栏无论宽度都使用同一张竖图和 `cover`。当面板占据主工作区时，图片按宽度放大，只剩蓝色手套等局部细节，人物和舞台关系消失。

### 快捷项首帧白闪

面板本身已能在零宽挂载阶段获得皮肤类，但快捷项仍依赖可见尺寸和几何阈值。列表在第一次布局前保留 Codex 的白色 `bg-token-bg-fog`，下一次刷新才变为主题表面。

### 选项外框过重

当前每个快捷项都有半透明底色、边界和内描边。宽栏下这些连续矩形变成独立卡片列，割裂背景，也不符合用户要求的无框选项。

### 输入焦点线外溢

全局 `[contenteditable="true"]:focus-visible` 使用 `3px` 外描边并带 `3px` 偏移。Codex 编辑器原本要求 `outline: none`，但被主题的 `!important` 覆盖。宽栏下浮动输入框高度较低，外描边表现为上下两条青色横线。

## 响应式画面

布局状态由面板实际宽度决定，素材选择由拖拽停止后的面板宽高比决定，不使用窗口媒体查询。

### 紧凑状态

- 宽度小于等于 `440px`。
- 停止拖拽后宽高比通常小于 `0.82`，选择近景图。
- 近景继续使用底部居中的 `cover`。

### 过渡状态

- 宽度介于 `440px` 和 `840px`。
- ResizeObserver 发现宽度变化后立即设置拖拽遮罩，隐藏所有人物画面。
- 最后一次宽度变化停止 `120ms` 后计算 `width / height`。
- 比例小于 `0.82` 选择近景，比例大于等于 `0.82` 选择完整舞台。
- 遮罩移除后只对选中的画面做一次短淡入，不在拖拽过程中混合两张素材。

### 工作区状态

- 宽度大于等于 `840px`。
- 停止拖拽后宽高比通常大于等于 `0.82`，使用完整的 `1840×1080` 舞台图。
- 环境层使用同图 `cover`、低饱和和轻微模糊，填满极宽或偏高的面板比例。
- 主场景层使用 `contain`，保证舞台边框和中心人物尽可能完整。
- 环境层只负责填充空白，不与主场景争夺注意力。

### 遮罩

- 明色模式使用冷白到蓝灰的低不透明遮罩，正文保持深色。
- 深色模式使用海军蓝到靛蓝遮罩，正文保持浅色。
- 中央快捷项区域通过连续渐变获得对比度，不绘制独立外框。
- 拖拽遮罩在明色模式使用不透明冷蓝灰，在深色模式使用不透明海军蓝，避免画面随每个像素重裁。
- `prefers-reduced-transparency: reduce` 下隐藏所有图片层并回退纯色。
- `prefers-reduced-motion: reduce` 下立即切换各画面层，不执行淡入。

## 运行时结构

面板内增加一个 Sidecar 自有、`aria-hidden="true"`、`pointer-events: none` 的绝对定位视觉层：

```text
aside.denia-old-days-ds-native-right-sidebar
├── div.denia-old-days-ds-native-sidebar-art
│   ├── span.denia-old-days-ds-native-sidebar-art-portrait
│   ├── span.denia-old-days-ds-native-sidebar-art-wide-ambient
│   ├── span.denia-old-days-ds-native-sidebar-art-wide-scene
│   └── span.denia-old-days-ds-native-sidebar-art-scrim
└── Codex 原生内容
```

- 视觉层不参与布局，不改变原生子节点顺序、尺寸、滚动和点击区域。
- 面板通过 `isolation: isolate` 建立局部堆叠上下文。
- 视觉层使用负层级，位于面板背景之上、原生内容之下。
- 切换面板或 cleanup 时移除自有视觉层。

## 拖拽监听

- 为当前原生右侧栏绑定一个 `ResizeObserver`。
- 观察回调在宽度变化时设置 `data-denia-sidebar-resizing="true"`，并重置唯一的 `120ms` 尾随计时器。
- 计时器到期后读取一次最终矩形，计算宽高比，并写入 `data-denia-sidebar-artwork="portrait|wide"`。
- 根节点公开 `data-denia-sidebar-layout="compact|transition|workspace"`，用于输入框和诊断状态。
- 面板零宽挂载时保持 `compact`，不覆盖最后可信的 `--denia-native-sidebar-width`。
- 面板更换或 cleanup 时断开 observer。
- 不新增 `setInterval`、滚动监听或网络请求。

## 快捷项

- 优先按稳定结构识别 `ul/ol > li` 内的按钮或链接。
- 结构识别不依赖 `visible()` 或非零尺寸，因此零宽挂载阶段即可加类。
- 几何识别作为非列表型未来版本的兼容回退。
- 列表容器和快捷项默认均为透明、无边框、无阴影。
- hover 和 `focus-visible` 只增加低强度连续底色，不恢复卡片边框。
- 图标、快捷键胶囊和语义状态仍由 Codex 原生结构控制。

## 底部输入

- 全局焦点规则继续服务按钮、链接和普通文本域。
- `.denia-old-days-ds-composer` 内的 ProseMirror 和文本域禁用外溢 outline。
- 输入框通过 `:has(...:focus-visible)` 在容器内部绘制 `2px` 焦点环。
- 工作区状态提高输入框底色不透明度和阴影分离度，保证浮在全景图上仍然清晰。
- 任务内容的自定义居中规则排除原生 `[data-thread-scroll-footer="true"]`，由 Codex 自己按剩余空间收缩和居中输入区，避免拖宽侧栏压住右侧按钮。
- 不直接修改输入框宽度、高度、圆角布局、工具栏位置、快捷键和提交行为。

## 素材管线

1. 将素材库 `dark-stage-complete.jpg` 的原始字节提升为 `art/source/official/denia-right-sidebar-wide.jpg`。
2. 在 `scripts/release-inputs.mjs` 声明构建输入。
3. 在 `scripts/render-assets.mjs` 生成 `sidecar/assets/denia-right-sidebar-wide.webp`。
4. 输出固定为 `1840×1080` WebP，quality `84`，目标小于 `1 MiB`。
5. manifest 增加 `rightSidebarWideArtwork`。
6. loader、runtime、live verification 和 cleanup 扩展为八张预加载资源。

运行时不读取附件或资料库路径，不访问远程资源。

## 验证

### 自动化

- 宽幅源文件哈希严格匹配。
- WebP 为 `1840×1080` 且小于 `1 MiB`。
- manifest、loader、runtime、对象 URL 和 cleanup 均包含宽幅资源。
- 零宽面板挂载时，列表快捷项在下一个动画帧前获得透明类。
- 宽度 `320/560/840/1240` 分别得到 `compact/transition/workspace/workspace`。
- `560px` 停止后选择近景，`840px` 停止后选择宽图；连续 ResizeObserver 通知只保留一个尾随决策。
- ResizeObserver 在面板切换和 cleanup 时断开。
- 快捷项默认透明、无边框、无阴影。
- composer 内编辑器没有外 outline，容器拥有内部 focus ring。
- 所有侧栏视觉节点均由 Sidecar 拥有并可清理。

### 运行时

- 浅色和深色模式均检查 `320px` 窄栏。
- 拖拽经过约 `560px` 和 `760px` 时只显示稳定遮罩；停止后分别按实际宽高比显示合适素材。
- 完全展开时完整舞台图可辨认，环境层没有抢占主场景。
- 快捷项首次出现即透明，无矩形容器边界。
- 输入框文字、占位符、按钮和焦点状态清晰，无青色横线。
- `560px` 侧栏下输入框右边缘不与侧栏相交。
- 关闭、重新打开和恢复面板宽度后状态正确。
- 结束验收后恢复用户原有主题和侧栏开关状态。

## 不在本次范围

- 修改左侧导航。
- 改变原生右侧栏拖拽范围。
- 重排快捷项或输入工具栏。
- 增加视差、呼吸、闪烁或自动播放动画。
- 根据任务状态切换宽栏背景。
