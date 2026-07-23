# 达妮娅主题纠偏实施记录

日期：2026-07-23

状态：本地实现完成，等待用户体验

## 已完成

- 找回完整官方舞台源图 `denia-poster-wide.png`。
- 将外部素材库重组为 `production-ready`、`source-media` 和 `reference-only`。
- 把官网透明舞台层标记为不可直接用于主题。
- 删除主题中的透明立绘源文件和 Portrait 运行时通道。
- 宽屏与紧凑首页统一使用《旧日斑斓》暖色剧情画面。
- 重做 P2 拍立得背纸、纸纹、显影边、翘角和阴影。
- 重做多层虹彩泡泡。
- working 保持明亮，approval 使用明亮形态舞台裁切，error 使用暗形态舞台裁切，complete 回到暖色。
- 生成六张可复现预览。

## 自动检查

```bash
KABOO_SHARP_ENTRY=/absolute/path/to/sharp/lib/index.js node scripts/render-assets.mjs
node scripts/check-source.mjs
node sidecar/tests/validate.mjs sidecar
node --check scripts/render-assets.mjs
node --check sidecar/runtime/loader.mjs
node --check sidecar/src/denia-old-days-extension.js
```

## 预览

- `evidence/home.png`
- `evidence/home-compact.png`
- `evidence/task.png`
- `evidence/task-approval.png`
- `evidence/task-error.png`
- `evidence/task-complete.png`

## 剩余

- 固定本地源码 revision 和构建哈希。
- 使用 Kaboo 构建本地 release。
- 在 Dream Skin 控制面可用时执行本地安装和验证。
- 停在用户体验阶段，不上传远程仓库，不发布 Registry。
