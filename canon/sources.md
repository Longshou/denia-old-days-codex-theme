# 达妮娅「旧日斑斓」来源记录

## 设定来源

| 类型 | 来源 | 用途 | 运行时分发 |
| --- | --- | --- | --- |
| 官方角色资料 | [库街区：达妮娅](https://wiki.kurobbs.com/mc/item/1488852222116831232) | 角色身份、形态名、配色和视觉意象 | 否 |
| 官方剧情动画 | [库街区：《旧日斑斓》](https://www.kurobbs.com/mc/post/1507356224033308672) | 手账、照片显影、纸雕和翻页节奏 | 否 |
| 官方角色展示 | [Denia — Human Mimicry Protocol](https://www.youtube.com/watch?v=rtMnPOV3DO8) | 服装、镜头、气泡和空质意象 | 否 |
| 第三方剧情录屏 | [Denia Book Animation Cutscene](https://www.youtube.com/watch?v=JBuVOIhnQ4k) | 只用于核对剧情动画的镜头构图 | 否 |

前三项为主要来源。第三方录屏只作视觉辅助，不作为 Canon 文案来源。

## 官方源文件

| 形态 | 文件 | 官方来源 | 尺寸 | SHA-256 |
| --- | --- | --- | --- | --- |
| Bright | `art/source/official/old-days-bright-102s.jpg` | [库洛官方《旧日斑斓》动画](https://www.kurobbs.com/mc/post/1507356224033308672)约 `00:01:42` 帧；[官方角色展示视频](https://www.youtube.com/watch?v=rtMnPOV3DO8) | 1920×1080 | `d0989c926a8dcb8033c21e781fc6c99a5d6e550d3233dac2789ca688e9c7f1dd` |
| Dark | `art/source/official/denia-poster-wide.png` | [库洛官方达妮娅横版海报](https://www.kurobbs.com/mc/post/1508896679676882944) | 1840×1080 | `1a5fc296eba320eff8fcab37be15fd017dce4b682ce4a4695c2dabbe1e54e6b1` |

紧凑首页复用 Bright 源文件，通过同一画面的裁切保持视觉连续，不再使用单独立绘。

这些文件是不可变的构建输入。项目仅作内部非官方粉丝主题使用，不主张对官方素材的所有权或再分发许可，也不隶属于、不受 OpenAI、库洛游戏或《鸣潮》权利方认可或赞助。

Codex 运行时仅使用包内 WebP 衍生图，不发起远程请求。运行包不使用第三方录屏画面、官方 Logo 或来源不明的字体。

## 原创源文件

| 文件 | 作者与方式 | 权利状态 | 用途 |
| --- | --- | --- | --- |
| `art/source/background.svg` | 本项目原创 SVG | 项目原创 | Base Theme 手账环境背景 |
| `art/source/task-preview.svg` | 本项目原创 SVG | 项目原创 | 脱敏任务预览 |

## 源文件校验

| 文件 | SHA-256 |
| --- | --- |
| `art/source/background.svg` | `e5e48058261a5ed08ad628afbe477cfa0f2ad075a8712a84c17b5a1da136c9b2` |
| `art/source/task-preview.svg` | `73f2e2309f8fafb70a5f5e3071cea610148541a8388e340e4883038ac85f6c92` |

上述哈希对应 `0.1.0` 首发候选原创源文件。官方源文件的固定哈希见前表；构建产物在构建时重新校验。

## 生成输出

以下输出由 `scripts/render-assets.mjs` 使用 bundled Sharp 确定性生成。尺寸为实际编码尺寸，哈希为 SHA-256。

| 输出 | 尺寸 | SHA-256 | 渲染设置 |
| --- | --- | --- | --- |
| `theme/background.jpg` | 1920×1080 | `9487911f2fea67f07cc97b8677727cacd8c4c3e35e0af971e0f0da3f9a4e473c` | `background.svg`；resize 1920×1080、cover；flatten `#f7eee9`；JPEG quality 90、4:4:4 |
| `sidecar/assets/denia-old-days-bright.webp` | 1440×810 | `fa471d994e9a974159ba8a39606841371d2ebff18b3ec3a84bde2438378f0706` | `old-days-bright-102s.jpg`；resize 1440×810、cover、centre；WebP quality 88、smartSubsample |
| `sidecar/assets/denia-old-days-dark.webp` | 1380×810 | `7d7436bf2f9127e06744797b004ea731a2d1a93ebebb8e16c4d71b1f42164b02` | `denia-poster-wide.png`；flatten `#17172f`；resize 1380×810、cover、centre；WebP quality 86、smartSubsample |
| `evidence/home.png` | 1600×1000 | `ee899ec6e0dbd24c3cef54d13e250174dc7d9d6ce223269d2f8ff9e5b864d57f` | Bright 单一画面；P2 背纸、纸纹、显影边和虹彩泡泡；PNG compressionLevel 9 |
| `evidence/home-compact.png` | 1200×800 | `f62fe79c5e0e5f708125394da5bf388dd3c8b6aee71ff15f90628eec9457d41b` | 与宽屏首页共用 Bright 画面，只改变拍立得尺寸和裁切 |
| `evidence/task.png` | 1600×1000 | `f6afefa7f446fceefc6795395d0d40ef6e07ec09ec6e39fb27f3ad96d9627a8f` | 暖色 working 状态，不显示暗色舞台 |
| `evidence/task-approval.png` | 1600×1000 | `27d0ab6ff4a6ce3028e8dec6a9e29a4c8a7f4a9deff1d25fd838a3ce66d4dc68` | 完整舞台源图中央明亮形态裁切 |
| `evidence/task-error.png` | 1600×1000 | `fcf56f6ba5da1d0a381ab1febac95558674de52bb621e3fdbba4da6f23cf07b7` | 完整舞台源图左侧暗形态裁切 |
| `evidence/task-complete.png` | 1600×1000 | `1545659091289e44e0498b3a8dff8e85bacf34ad57ea05b5754723e001206cd7` | 暖色 complete 状态和金色归档纸带 |
