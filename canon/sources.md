# 达妮娅「旧日斑斓」来源记录

## 设定来源

| 类型 | 来源 | 用途 | 运行时分发 |
| --- | --- | --- | --- |
| 官方角色资料 | [库街区：达妮娅](https://wiki.kurobbs.com/mc/item/1488852222116831232) | 角色身份、形态名、配色和视觉意象 | 否 |
| 官方剧情动画 | [库街区：《旧日斑斓》](https://www.kurobbs.com/mc/post/1507356224033308672) | 手账、照片显影、纸雕和翻页节奏 | 否 |
| 官方发布插画 | [达妮娅官方插画索引](https://wikiwiki.jp/w-w/%E3%83%80%E3%83%BC%E3%83%8B%E3%83%A3#official_illust) | 贺图、壁纸、双形态场景和状态情绪 | 否 |
| 官方二周年贺图 | [鸣潮日服官方 X](https://x.com/WW_JP_Official/status/2049081192532557960) | 完成态正脸近景与手势 | 否 |

角色 PV、战斗演示和第三方剧情录屏不再进入新素材候选。《旧日斑斓》是已经确认的首页剧情特例，不继续批量抽帧。

## 官方源文件

| 形态 | 文件 | 官方来源 | 尺寸 | SHA-256 |
| --- | --- | --- | --- | --- |
| Home | `art/source/official/old-days-bright-102s.jpg` | [库洛官方《旧日斑斓》动画](https://www.kurobbs.com/mc/post/1507356224033308672)约 `00:01:42` 帧 | 1920×1080 | `d0989c926a8dcb8033c21e781fc6c99a5d6e550d3233dac2789ca688e9c7f1dd` |
| Legacy stage | `art/source/official/denia-poster-wide.png` | [库洛官方达妮娅横版海报](https://www.kurobbs.com/mc/post/1508896679676882944) | 1840×1080 | `1a5fc296eba320eff8fcab37be15fd017dce4b682ce4a4695c2dabbe1e54e6b1` |
| Warm rail | `art/source/official/denia-garden-bubbles-warm.jpg` | [官方发布插画索引](https://wikiwiki.jp/w-w/%E3%83%80%E3%83%BC%E3%83%8B%E3%83%A3#official_illust) | 1920×1080 | `481bf5ff8fa4f54d5b696f6144fb3f6a7d3b2d8b580cf2a5baee39409110489b` |
| Dark rail | `art/source/official/denia-dark-direct-gaze.jpg` | [官方发布插画索引](https://wikiwiki.jp/w-w/%E3%83%80%E3%83%BC%E3%83%8B%E3%83%A3#official_illust) | 3840×2160 | `aae25be7ff9670c43a8f36a4019fa445c28fb51c57f69a477c008277bc197292` |
| Complete rail | `art/source/official/denia-anniversary-direct-gaze.jpg` | [官方二周年贺图](https://x.com/WW_JP_Official/status/2049081192532557960) | 1080×1920 | `dea27e716f9561131e2b5255ea60a84de2512e8e81886073f09c64e02739fc6e` |
| Wide scene | `art/source/official/denia-dual-form-panorama.jpg` | [官方发布插画索引](https://wikiwiki.jp/w-w/%E3%83%80%E3%83%BC%E3%83%8B%E3%83%A3#official_illust) | 4096×2304 | `646b290ae6a7584ce617cad85976f5caa6ae74e6d6678cd86a17a028266648b5` |
| Approval rail | `art/source/official/denia-approval-dual-form.jpg` | [官方发布插画索引](https://wikiwiki.jp/w-w/%E3%83%80%E3%83%BC%E3%83%8B%E3%83%A3#official_illust)的周年双形态竖幅贺图 | 1871×3327 | `3339a65536eb6b8cff762f4ac441df6358e857c8b25f0ddaecbade8e457f84c0` |
| Error rail | `art/source/official/denia-error-reaching.jpg` | [官方发布插画索引](https://wikiwiki.jp/w-w/%E3%83%80%E3%83%BC%E3%83%8B%E3%83%A3#official_illust)的周年插画展发布图 | 1920×1080 | `42c2a49b83de911a01627501875e6df992ac26da556c90b2c64433883eb353f4` |

紧凑首页复用 Home 源文件，通过同一画面的裁切保持视觉连续，不再使用单独立绘。任务侧栏按状态使用独立的 `rail-portrait` 衍生图；Approval rail 保留明色正脸和上方暗色注视，Error rail 保留无笑意正脸和伸手动作；Wide scene 保持完整横图，仅用于适合宽幅叙事的版式。

这些文件是不可变的构建输入。项目仅作内部非官方粉丝主题使用，不主张对官方素材的所有权或再分发许可，也不隶属于、不受 OpenAI、库洛游戏或《鸣潮》权利方认可或赞助。

Codex 运行时仅使用包内 WebP 衍生图，不发起远程请求。运行包不使用第三方录屏画面、角色 PV、战斗演示、官方 Logo 或来源不明的字体。上传 Kaboo Registry 前仍需确认官方发布插画的再分发边界。

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
| `sidecar/assets/denia-task-warm.webp` | 640×2000 | `97e767e03cc02df0b76b11106c1697918608823706842bb92d37e80c7b37431f` | 花园泡泡壁纸的无字近景；`245,0,346×1080`；WebP quality 86 |
| `sidecar/assets/denia-task-approval.webp` | 640×2000 | `d8e9124ad68a04021c8911819a6e21cba51b543f480a505cb3a24b98caa347a9` | 双形态竖幅的明色正脸与暗色注视；`470,220,896×2800`；WebP quality 86、smartSubsample |
| `sidecar/assets/denia-task-error.webp` | 640×2000 | `fda59d7601ac0937ca7962056e982dd020be60b9fbf0166d3ae0feedcac76482` | 无笑意正脸与伸手动作；`1040,80,288×900`；WebP quality 86、smartSubsample |
| `sidecar/assets/denia-task-complete.webp` | 640×2000 | `8328e475e0b73cd7f94b7425b85747a228fa70f78bcf9fd267c26a175bd66bc3` | 周年贺图的无字近景；`330,100,464×1450`；WebP quality 86 |
| `evidence/home.png` | 1600×1000 | `ee899ec6e0dbd24c3cef54d13e250174dc7d9d6ce223269d2f8ff9e5b864d57f` | Bright 单一画面；P2 背纸、纸纹、显影边和虹彩泡泡；PNG compressionLevel 9 |
| `evidence/home-compact.png` | 1200×800 | `f62fe79c5e0e5f708125394da5bf388dd3c8b6aee71ff15f90628eec9457d41b` | 与宽屏首页共用 Bright 画面，只改变拍立得尺寸和裁切 |
| `evidence/task-staged.png` | 1600×1000 | `b4758998866ee163df300aa92ad3de2dae6720819bc220d569222e2399f604c8` | 暖日泡泡近景低透明待命态 |
| `evidence/task.png` | 1600×1000 | `89e6fc3488c9380d686e59edf9cd2fb544c69f5cc9ee25e1c8359e05f039ab62` | 同一暖日泡泡近景提高对比、轻微靠近工作区后的工作态 |
| `evidence/task-approval.png` | 1600×1000 | `3bb6150bbe544d3901acaf612ed4e5b926dcdd7eb369aa14ef91eda7d10929f3` | 双形态审批态；源图 extract `470,220,896×2800` |
| `evidence/task-error.png` | 1600×1000 | `60a0c13730593465017a5932489beaad62bfa8cf1f54ef0ebaf57d2c07e75bec` | 无笑意、伸手错误态；源图 extract `1040,80,288×900` |
| `evidence/task-working-to-approval-350ms.png` | 1600×1000 | `5dc44274e6afc140eb838ebb4a0d63291a732f615503300bb3f2fe3001b49e68` | Working→Approval 350ms 受控过渡；Approval 源图 extract `470,220,896×2800` |
| `evidence/task-error-to-complete-500ms.png` | 1600×1000 | `1944eaf3576059db07f4b32bb0745ca05beb05e02d0f88715fb33ce2440ce57a` | Error→Complete 500ms 受控过渡；Error 源图 extract `1040,80,288×900` |
| `evidence/task-complete.png` | 1600×1000 | `99b165cf277ab70ef438eca80759bb272875db4f30fbf66fd3840b3dd3a5f1e3` | 无周年宣传字样的完成态近景，右下链饰区域覆轻纸雾 |

## 2026-07-23 视觉复核

- 七张首页与任务截图均无宣传文字、Logo 或多图叠放污染。
- `staged`、`working`、`complete` 保持暖亮形态；`approval`、`error` 限定为严肃暗形态。
- 审批与错误使用独立官方图：审批保留明暗双形态等待感，错误保留无笑意正脸与伸手动作；错误不使用 glitch、抖动或额外文字。
- 右栏与工作区保持单向纸雾过渡，桌面端预留安全间距，窄屏隐藏。
- UI/UX 审查无 P0；完成两项 P1 微调后进入本地小范围体验测试。
