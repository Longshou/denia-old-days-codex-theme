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
| Bright | `art/source/official/old-days-bright-102s.jpg` | 库洛官方《旧日斑斓》动画约 `00:01:42` 帧 | 1920×1080 | `d0989c926a8dcb8033c21e781fc6c99a5d6e550d3233dac2789ca688e9c7f1dd` |
| Dark | `art/source/official/denia-poster-wide.png` | 库洛官方达妮娅横版海报 | 1840×1080 | `1a5fc296eba320eff8fcab37be15fd017dce4b682ce4a4695c2dabbe1e54e6b1` |
| Compact | `art/source/official/denia-portrait.png` | 库洛官方达妮娅透明立绘 | 1186×1844 | `95ad359595edc790084194504dbbd7a5245c6428b9ec78a1aca4dc7bab994245` |

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
| `art/source/background.svg` | `f434bc0fbf01523e8198f7f41bdb546c98186e99a6c0c5ab44a5ca6ed1a6df1a` |
| `art/source/task-preview.svg` | `ed9b47544f1fbd589d1124b8c63a6a650811632dcce6d5340fd8ddb1092d9ade` |

上述哈希对应 `0.1.0` 首发候选原创源文件。官方源文件的固定哈希见前表；构建产物在构建时重新校验。

## 生成输出

以下输出由 `scripts/render-assets.mjs` 使用 bundled Sharp 确定性生成。尺寸为实际编码尺寸，哈希为 SHA-256。

| 输出 | 尺寸 | SHA-256 | 渲染设置 |
| --- | --- | --- | --- |
| `theme/background.jpg` | 1920×1080 | `b3352709208491ffc83e8a3584d55a39b55084089935e528e7c432662413e797` | `background.svg`；resize 1920×1080、cover；flatten `#eaf7f7`；JPEG quality 88、4:4:4 |
| `sidecar/assets/denia-old-days-bright.webp` | 1440×810 | `5ce63c2e47e899f03d48f297f5299dfa38a120e1dd2fd9dc42d1f2dc04f096d8` | `old-days-bright-102s.jpg`；resize 1440×810、cover、centre；WebP quality 86、smartSubsample |
| `sidecar/assets/denia-old-days-dark.webp` | 1380×810 | `231c830b54ac2f8e459a0281a5e0b3b85fb4e27baf12be764e4507b4c2b02bc0` | `denia-poster-wide.png`；resize 1380×810、cover、centre；WebP quality 84、smartSubsample |
| `sidecar/assets/denia-old-days-portrait.webp` | 640×995 | `8b7e6b85bc9ed0379df5c5071182ab412cea7a08d7b89e15811478a762dac146` | `denia-portrait.png`；resize 边界 640×996、inside、withoutEnlargement；WebP quality 88、alphaQuality 92 |
| `evidence/home.png` | 1600×1000 | `f9a0e866b237af0de53b83e8f491371af52d1bc9cd77bf879659b856e44a1388` | `background.svg` resize 1600×1000、cover；Bright resize 610×343、cover、centre，extend 18/18/52/18 `#fffef8`，rotate -1.2°；合成内联 UI overlay；PNG compressionLevel 9 |
| `evidence/task.png` | 1600×1000 | `6621bd1b9c281d111be86fe117af266b0e5e21e5e5796136e2bed8490330104f` | `task-preview.svg` resize 1600×1000、cover；Dark 衍生图 resize 148×1000、cover、centre，ensureAlpha，alpha 0.16，置于 x=1452；最终 resize 1600×1000、cover；PNG compressionLevel 9 |
