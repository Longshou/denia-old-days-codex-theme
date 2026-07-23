# 达妮娅任务状态 UI/UX 快速审查

设计判断：现有产品工作区的状态转场复审，面向持续工作的 Codex 用户；视觉语言应保持“浅色手账工作区 + 单侧形态显影”，设计变化度 5/10、动效强度 5/10、信息密度 5/10。

> 2026-07-23 素材复审补充：本审查中“同一单人透明立绘/同一舞台图”的素材建议已被后续窄侧栏实裁推翻。固定侧栏、工作/美术分层、单一焦点、透明度和动效结论继续有效；稳定状态素材改为少量构图相容的官方贺图与壁纸近景，详见[状态转场设计](../superpowers/specs/2026-07-23-denia-state-transition-design.md)。

## Verdict

状态语义清楚，但 approval/error 的满高角色图压住工作区，working/complete 又完全空栏，五态形成“空、满、更满、空”的断裂，尚未形成稳定的双形态状态系统。

## 优先级

### P0

- **先分开美术层与工作层。** 当前 360px 右侧美术层覆盖内容区，approval/error 中输入框右端被遮住。任务主栏需预留固定侧栏宽度，或把美术栏缩到 280-320px，并用 1px 分隔线加 24-40px 单向淡出边界。
- **每个状态只保留一个主体。** approval 的横版海报裁切出现多个视觉焦点，接近拼贴。后续素材复审要求使用正脸/近景、直接注视或朝向工作区、带一个叙事道具的固定窄裁；不再使用独立透明立绘或把完整横图硬塞入侧栏。

### P1

- working 与 complete 不能空栏。working 使用低对比暖日泡泡壁纸近景，complete 使用周年正脸贺图近景，维持角色陪伴感并避免单独全身立绘。
- approval 的目标透明度从 `.94` 降到 `.38-.46`；error 从 `1` 降到 `.52-.60`。错误强度交给洋红边缘、状态标题和气泡，不靠整屏暗图。
- approval 与 error 使用相同 `background-position`。当前 `50% center` 到 `8% center` 会产生硬切，破坏同一形态的连续性。
- 单一 `::after` 不足以完成跨素材交叉淡化。增加固定尺寸的 `current` 与 `next` 两个交换层；两个图层使用同一侧栏盒和眼位高度带。

### P2

- 状态气泡只保留边框色和 8%-14% 底色，不再叠加强发光。
- complete 的暖金只落在页眉波纹、状态 pill 和布景之形高光，工作区底色继续保持冷白。
- error 不增加循环 glitch、抖动或闪烁。一次性短促色偏即可。

## 明暗与情绪曲线

主工作区保持 92%-98% 的浅色亮度，变化集中在侧栏和状态标记。

| 状态 | 侧栏美术 | 建议透明度 | 色调与情绪 |
| --- | --- | ---: | --- |
| staged | 暖日泡泡近景，固定裁切 | .10-.12 | 中性、安静 |
| working | 同一暖日泡泡近景 | .18-.22 | 冷青、专注 |
| approval | 暗色正脸近景 | .40-.46 | 低饱和紫、悬停 |
| error | 同一暗色严肃正脸 | .52-.58 | 深紫加窄幅洋红、警觉 |
| complete | 周年正脸贺图近景 | .24-.30 | 暖金高光、收束 |

曲线：staged 明亮中性 → working 轻微降亮 → approval 明显降亮 → error 最暗但不压黑工作区 → complete 回升到接近 staged，并留下少量暖金。

## 0-900ms 状态转场

| 时间 | 动作 |
| ---: | --- |
| 0-80ms | 更新状态文字、`aria-live` 与色彩 token；保持旧美术层不动。 |
| 80-220ms | 状态气泡、页眉波纹和边框颜色完成切换。 |
| 120-420ms | 旧形态 `opacity` 降到 0，轻移 8px；不改变裁切位置。 |
| 220-620ms | 新形态在同一锚点从 `opacity: 0` 到目标值，`translateX(12px) scale(.985)` 回到静止。 |
| 420-760ms | tint 与侧栏渐隐边界收束，主工作区不参与明暗动画。 |
| 760-900ms | 一次性阴影衰减完成；不保留循环动画。 |

`prefers-reduced-motion: reduce` 下直接呈现终态：无位移、缩放、交叉淡化、glitch 和延迟。现有 CSS 已把 transition 压到 `0.01ms`；JS 也应跳过 900ms 编排并取消未完成的状态计时器。

## working 与 complete 侧栏

- **working：** 暖日泡泡壁纸的正脸近景，视线朝向用户或工作区，保留泡泡、猫或玩偶中的一个叙事焦点，透明度 `.18-.22`。不新增文字，状态文字仍由观察区和 pill 承担。
- **complete：** 周年正脸贺图的近景裁切，眼位与 working 保持同一高度带，透明度 `.24-.30`，加轻微暖金高光。裁掉底部宣传文字，保持静态，不使用庆祝粒子或循环呼吸。

## 可执行 CSS 建议

```css
:root {
  --denia-state-rail-width: clamp(280px, 20vw, 320px);
  --denia-state-ease: cubic-bezier(.22, 1, .36, 1);
}

.denia-old-days-ds-task main {
  padding-inline-end: calc(var(--denia-state-rail-width) + 24px);
}

.denia-old-days-ds-state-art {
  position: fixed;
  inset: 0 0 0 auto;
  width: var(--denia-state-rail-width);
  overflow: hidden;
  isolation: isolate;
  pointer-events: none;
  border-inline-start: 1px solid rgba(89, 132, 145, .14);
  mask-image: linear-gradient(90deg, transparent 0, #000 32px);
}

.denia-old-days-ds-state-art > span {
  position: absolute;
  inset: 0;
  background-position: 50% bottom;
  background-repeat: no-repeat;
  background-size: auto 92%;
  opacity: 0;
  transform: translateX(12px) scale(.985);
  transition:
    opacity 400ms var(--denia-state-ease),
    transform 500ms var(--denia-state-ease),
    filter 500ms var(--denia-state-ease);
}

[data-denia-form-state="working"] .denia-state-art-light { opacity: .16; transform: none; }
[data-denia-form-state="approval"] .denia-state-art-dark { opacity: .42; transform: none; }
[data-denia-form-state="error"] .denia-state-art-dark { opacity: .56; transform: none; }
[data-denia-form-state="complete"] .denia-state-art-light {
  opacity: .20;
  transform: none;
  filter: sepia(.18) saturate(.88);
}

@media (prefers-reduced-motion: reduce) {
  .denia-old-days-ds-state-art > span {
    transition: none !important;
    transform: none !important;
  }
}
```

以上 CSS 仅记录固定侧栏、透明度和动效方向；`light` / `dark` 选择器已由后续双交换层方案取代，不应原样实施。

若无法安全修改原生 `main` 的 padding，则把侧栏宽度限制为 280px，并将任务卡与 composer 的 `max-width` 收到侧栏左边界，不能继续覆盖输入区。

## 可执行 JS 建议

- 创建一次 `.denia-old-days-ds-state-art`，内部只有 `current` 与 `next` 两个交换层；图片预加载，节点不在每次状态变化时重建。
- `refresh()` 更新 `data-denia-form-state`、状态文案和新层的包内图片 token；每张图的 `background-position` 在稳定状态中固定。approval 与 error 复用同一张无笑正脸图，避免错误态出现不合时宜的微笑。
- 记录上一个状态并取消未完成的 `animationend`/timeout 清理，避免快速 working→approval→error 时出现旧动画回写。
- 监听 `matchMedia("(prefers-reduced-motion: reduce)")` 的变化；reduce 开启时立即移除 transition 标记并呈现终态。
- error 的色偏只执行一次，最多 120ms；不要用无限动画。

## 审查依据

- `evidence/task.png`
- `evidence/task-approval.png`
- `evidence/task-error.png`
- `evidence/task-complete.png`
- `sidecar/src/denia-old-days-extension.css` 第 69-87、551-584 行
- `scripts/render-assets.mjs` 的 `TASK_STATE_ART`
