# 主题运行时增量刷新治理

## 目标

在不改变首页、任务页、侧栏、输入框和状态美术视觉结果的前提下：

- 删除已经不可见的首页建议卡功能及其维护链路。
- 将全量 `refresh()` 改为按脏域执行的增量刷新。
- 降低任务流更新时的全局 DOM 查询、几何测量和样式读取。
- 保留面板动画防抖、即时状态标记、运行时清理和诊断接口。

## 不在本次范围

- 不调整 WebP 尺寸、质量或加载协议。
- 不修改颜色、阴影、模糊、动效参数和状态图。
- 不修改 Codex 原生布局尺寸、面板动画和终端初始化。
- 不重写侧栏识别算法，只减少其无关调用。

## 删除隐藏建议卡

当前建议卡槽位永久使用 `display: none`，运行时仍扫描原生按钮、创建代理按钮、隐藏原生建议、维护槽位高度并代理点击。本次删除：

- `extension.json` 中的 `cardLabels` 和 `home.suggestion-cards`。
- suggestion slot、card deck、native suggestion hiding 的 CSS 及响应式规则。
- `suggestionSlotHeight`、建议按钮扫描、槽位和卡组创建、点击代理、原生 class 恢复。
- loader cleanup 和 verify 中的建议卡兼容分支。
- 只服务于建议卡的静态、行为和布局测试。

首页识别改为：

1. 优先识别 `.dream-skin-home`。
2. 无助手消息时，识别原生首页标题。

原生首页标题的发现和位置同步保留，并从建议按钮参数中解耦。

## 脏域刷新

运行时使用位掩码合并以下脏域：

| 脏域 | 工作 |
| --- | --- |
| `route` | 找到主区域、判断首页或任务页、同步根 class |
| `composer` | 找到并装饰输入框、发送和附件按钮 |
| `sidebar` | 同步左右侧栏、侧栏分组和行样式 |
| `layout` | 同步任务内容宽度、右侧栏几何、首页视觉框架 |
| `work-surfaces` | 同步右侧栏、置顶摘要和底部面板状态 |
| `home` | 同步品牌、hero、原生首页标题和首页滚动位置 |
| `task-state` | 推导 staged、working、approval、error、complete |
| `task-decoration` | 装饰新增工具节点、reasoning、details 和最新助手卡 |
| `art` | 同步状态美术 |

`state.refresh()` 继续执行全部脏域，供安装、验证和诊断使用。正常 observer、路由和 resize 只提交需要的脏域。

### 调度

- 同一帧内的脏域合并后执行一次。
- style-only 动画记录继续使用 80ms 尾部防抖。
- 动画期间到达的语义变更并入同一个尾部任务，不延长已有计时器。
- 原生侧栏、置顶摘要和底部面板 toggle 的 dataset 标记在 observer 回调中立即同步。
- resize 只提交 `sidebar`、`layout`、`work-surfaces` 和当前页面域。
- popstate、hashchange 提交全部脏域。

### 缓存

- 缓存 composer 和 sidebar、summary、bottom 三个 toggle。
- 缓存节点必须仍然连接、满足语义标签和排除条件。
- 相关节点被添加、移除，或其 `aria-*`、`data-state`、class 发生语义变化时失效。
- 缓存只减少重复查询，不改变检测规则。

## 增量任务装饰

初次安装和路由切换时扫描当前任务主区域。后续 childList 记录只收集新增元素根节点：

- 新增根本身匹配工具、reasoning、details 或 assistant 时直接处理。
- 新增根的后代只在该根内查询。
- 记录上一个 final card；完成态或最新助手变化时只移除旧 class、添加新 class。
- 删除节点不再进入历史集合；cleanup 仍移除所有运行时添加的 class 和 dataset。

## 可观察性

`state.metrics` 保留 `refreshes` 和 `createdNodes`，新增 `domainRuns`：

```js
{
  route: 0,
  composer: 0,
  sidebar: 0,
  layout: 0,
  workSurfaces: 0,
  home: 0,
  taskState: 0,
  taskDecoration: 0,
  art: 0,
}
```

测试使用计数确认任务内容变更不会执行 sidebar、layout、composer 和 home 域。

## 验收

- 首页不再创建 suggestion slot、card deck 或隐藏原生建议按钮。
- 首页 hero、原生标题位置、composer 和项目选择保持当前几何。
- 任务新增工具节点和最新助手卡在下一次增量刷新后完成装饰。
- 任务内容 mutation 不执行侧栏几何检测。
- composer 或面板替换后缓存正确失效并重新绑定。
- style 动画仍在静止 80ms 后最多执行一次相关刷新。
- 面板四个方向每 900ms 的 refresh 不超过 5 次。
- 稳定任务页 100 次全量诊断刷新不作为正常路径；任务内容增量刷新平均目标低于 1ms。
- `npm run check`、实时 verify、面板探针和 cleanup 验证通过。
