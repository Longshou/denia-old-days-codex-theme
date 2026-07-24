# Task 2 Report — Home Suggestion Slot and Observer Stability

## 状态

实现完成；提交记录随本任务提交。

## 实现

- 首页现在在 hero 后创建 `#denia-old-days-ds-suggestion-slot`。该槽位始终保留，四个语义原生动作齐全时卡组是它唯一的子节点；动作不足时只移除卡组并恢复原生类。
- 槽位保存最近一次有效卡组的测量高度到 `state.suggestionSlotHeight`，仅在数值变化时写入 CSS custom property；离开首页或 cleanup 时清零。
- CSS 将外部 margin、宽度和非零响应式高度回退移到槽位：桌面 `92px`、中屏 `196px`、窄屏 `404px`。空槽 `pointer-events: none`，卡组恢复 `pointer-events: auto`，且自身没有伪造交互节点。
- 新增比较后再写入的 class、dataset 和 CSS-property helper；根状态、侧栏状态、状态图 rail/layer、原生同步和任务最终卡均使用它们。
- MutationObserver 请求 `attributeOldValue`，忽略 owned node/后代、仅含 `denia-old-days-ds-*` 差分的 class record，以及仅包含 owned node 的 child-list；同批次任一原生 mutation 仍只排队一次 refresh。
- loader 的 fallback cleanup、只读 verify 输出和 validator 均识别槽位，并将其几何与保留高度作为非交互诊断信息报告。

## 测试与 RED/GREEN 证据

- 先扩展 VM harness：record-level delivery、`attributeOldValue`、style/dataset mutation 记录与 child-list removal 记录。
- 先写 `[4] -> [0/3] -> [4]` 生命周期测试：持久空槽、最后有效高度、工作区 y 位置、禁用态、当前原生按钮 click mapping、home teardown/cleanup。
- 先写 observer 测试：纯主题 class delta、owned descendants、owned child-list、mixed native batch、无写入的重复 refresh 和两秒等价窗口的 refresh 上限。
- RED：`node sidecar/tests/validate.mjs sidecar` 以非零退出；失败为 `a stable sidebar refresh must not emit extension-only class mutations that schedule another refresh`，证明原实现会因主题 style/class 写入形成 refresh 回路。
- GREEN：同一 focused validator 在实现后退出码 0，输出 `Validated 达妮娅 · 旧日斑斓 extension 0.1.0: 20 required files, removable sidecar protocol.`

## 完整验证

- `node sidecar/tests/validate.mjs sidecar`：退出码 0。
- `node scripts/check-source.mjs`：退出码 0，输出 `source structure ok`。
- `git diff --check`：退出码 0。

## 改动文件

- `sidecar/src/denia-old-days-extension.js`
- `sidecar/src/denia-old-days-extension.css`
- `sidecar/runtime/loader.mjs`
- `sidecar/tests/validate.mjs`
- `docs/current-theme-design.md`
- `docs/superpowers/plans/2026-07-24-error-card-stability-legacy-cleanup.md`（按要求修正唯一的 `current-design.md` 路径笔误）
- `.superpowers/sdd/task-2-report.md`

## 自审

- 代理按钮继续只点击运行时重新发现的当前语义原生按钮；空槽没有 button、role、label、tab stop 或 pointer surface。
- Task 1 的 `explicitCommandFailureVisible()` 和 `data-testid` 观察逻辑未放宽或改写。
- observer 没有在 refresh 期间 disconnect；原生 `style`、`class`、ARIA、状态与 `data-testid` 仍在 attribute filter 中。
- CSS 响应式回退严格对应四张卡在 4/2/1 列时的 `92/196/404px` 行高度。

## 问题与顾虑

- 只读状态检查发现已有 renderer 在运行，但它使用的是未安装本次改动的旧包：verify 报告 `suggestionSlot: null`，且 `metrics.refreshes: 315105`。为遵守“不安装、不启动、不重启 Codex”，未写入该安装包；因此没有把该 live 结果当作本次实现的通过证据。
- 未发现需要额外架构决策的 brief 外分岔。

## 审查修复（后续提交）

- class mutation 现在通过 `getAttribute('class')` 读取当前 token；新增 SVGAnimatedString 形状 class record 回归，避免对 SVG 的 `className` 对象调用 `split()`。
- owned subtree 与 child-list node 判定分离：target 可沿当前 active owned subtree 判断；added/removed node 只使用 `WeakSet` 中的稳定 direct ownership。新增“当前挂在 owned ancestor 下的 native remount batch”回归，确保它仍调度 refresh。
- 离开首页复用原生 suggestion class 恢复逻辑；deck 先于 slot 清理，并在 detached 后从 `ownedNodes` 删除；cleanup 也使用相同顺序，避免长期 Set 保留 detached deck。
- observer 新增 `disabled` 与 `aria-disabled`；代理禁用态读取当前原生 `disabled` 或 `aria-disabled="true"`，测试通过真实 mutation delivery 验证 property 与 ARIA 两条路径。
- 每次 ensure 都把 slot 重新放回 hero 的紧邻后方；workspace y 测试改为由前序 sibling 与 retained slot height 推导，不再使用固定 rect。
- VM dataset proxy 改为记录每一次写入，以保证 compare-before-write 测试会捕捉冗余 dataset mutation。

### 审查修复验证

- RED：扩展回归后 `node sidecar/tests/validate.mjs sidecar` 先后暴露“slot 未紧随 hero”“disabled 未观察”“home teardown 未恢复”“SVG className 非字符串”“native remount 被吞掉”等失败点。
- GREEN：`node sidecar/tests/validate.mjs sidecar` 退出码 0，输出 `Validated 达妮娅 · 旧日斑斓 extension 0.1.0: 20 required files, removable sidecar protocol.`
- `node scripts/check-source.mjs`：退出码 0，输出 `source structure ok`。
- `git diff --check`：退出码 0，无空白错误。

## 第二轮审查修复（后续提交）

- 原生建议动作的发现改为要求节点仍连接、具有有效几何且未被 `aria-hidden`、`display: none` 或 `visibility: hidden` 隐藏；仅当零透明度来自 `denia-old-days-ds-native-card` 或 `denia-old-days-ds-native-suggestions` 时继续接受。这让主题隐藏原生卡后，重复 refresh 仍能保留代理卡和当前 click mapping。
- 代理 `disabled` 同步改为 compare-before-write；VM harness 的 disabled setter 记录每次 property 写入，稳定 refresh 因而能捕获同值反射。

### 第二轮审查修复验证

- RED：新增主题零透明度回归最初失败为 `theme-hidden native actions must keep the existing deck mounted on a repeated refresh`；修正发现逻辑后，新增 disabled 回归按预期失败为 `a stable refresh with a disabled native action must not reflect the same disabled value onto proxies`。
- GREEN：`node sidecar/tests/validate.mjs sidecar` 退出码 0，输出 `Validated 达妮娅 · 旧日斑斓 extension 0.1.0: 20 required files, removable sidecar protocol.`
- `node scripts/check-source.mjs`：退出码 0，输出 `source structure ok`。
- `git diff --check`：退出码 0，无空白错误。

## 第三轮审查修复（后续提交）

- 本节取代第二轮的透明度 class 例外：原生建议 container/button 的主题 CSS 不再声明 `opacity: 0`，继续使用 1px 尺寸、clip/clip-path、overflow 与 `pointer-events: none` 进行视觉和交互隐藏。
- `nativeSuggestionButtons()` 恢复使用通用 `visible()` 判断；因此原生界面真正淡出到零透明度的旧动作会被排除，即使它仍带有 `denia-old-days-ds-native-*` class。
- 测试在已装饰的旧动作被原生 opacity 淡出后并行挂载一组当前动作，验证 discovery 与代理点击只选择当前动作；常规重复 refresh、property/ARIA disabled 同步及稳定 refresh 的同值 disabled 零写入回归仍保留。

### 第三轮审查修复验证

- RED：`node sidecar/tests/validate.mjs sidecar` 按预期失败为 `an opaque stale native action must not displace the current proxy click target`，证明旧 class 透明度例外会优先选择旧动作。
- GREEN：`node sidecar/tests/validate.mjs sidecar` 退出码 0，输出 `Validated 达妮娅 · 旧日斑斓 extension 0.1.0: 20 required files, removable sidecar protocol.`
- `node scripts/check-source.mjs`：退出码 0，输出 `source structure ok`。
- `git diff --check`：退出码 0，无空白错误。
