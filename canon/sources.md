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

紧凑首页复用 Home 源文件，通过同一画面的裁切保持视觉连续，不再使用单独立绘。任务侧栏按状态使用独立的 `rail-portrait` 衍生图；Approval rail 保留明色正脸和上方暗色注视，Error rail 优先保留完整无笑意正脸与抬臂动势；Wide scene 保持完整横图，仅用于适合宽幅叙事的版式。

这些文件是不可变的构建输入。项目仅作内部非官方粉丝主题使用，不主张对官方素材的所有权或再分发许可，也不隶属于、不受 OpenAI、库洛游戏或《鸣潮》权利方认可或赞助。

Codex 运行时仅使用包内 WebP 衍生图，不发起远程请求。运行包不使用第三方录屏画面、角色 PV、战斗演示、官方 Logo 或来源不明的字体。上传 Kaboo Registry 前仍需确认官方发布插画的再分发边界。

## 美术资源库补充素材

| 形态 | 文件 | 官方来源 | 提取信息 | 尺寸 | SHA-256 |
| --- | --- | --- | --- | --- | --- |
| Dark smile close-up | `art/reference/visual-library/production-ready/denia-dark-form-smile-closeup.png` | [Wuthering Waves 官方 X：Post-Lament Anthropocene: Stars Intertwined — Denia](https://x.com/Wuthering_Waves/status/2037002852649099578) | 官方 1080×1920、10.368 Mbps 视频；请求 `00:07.8167`，实际帧 PTS `00:07.8078`；无 Logo、文字或媒体水印；PNG 无二次有损编码 | 1080×1920 | `1dcbfa127968c2386ad77da325f850ad4985bccc95959d915652df36dcba2296` |

该补充素材目前只进入本地美术资源库，尚未接入主题运行时。用于确认画面的 Inside Games 640×1137 媒体压缩图未入库；抽帧母视频的 SHA-256 为 `d6fc25fc7ffa0c666eea0632b331edc68725dd50600d5d7d46c4637264d1de69`。

## 原创源文件

| 文件 | 作者与方式 | 权利状态 | 用途 |
| --- | --- | --- | --- |
| `art/source/background.svg` | 本项目原创 SVG | 项目原创 | Base Theme 手账环境背景 |
| `art/source/task-preview.svg` | 本项目原创 SVG | 项目原创 | 脱敏任务预览 |

## 源文件校验

| 文件 | SHA-256 |
| --- | --- |
| `art/source/background.svg` | `1169ea2d6968951d73fff3a25c7aec8c4519537d4e564e7b2c44374d4376ae06` |
| `art/source/task-preview.svg` | `79a6b9698cacca28c58c9165ad69074c5bbd92a8866df512a93b41e35ea8b53e` |

上述哈希对应 `0.1.0` 首发候选原创源文件。官方源文件的固定哈希见前表；构建产物在构建时重新校验。

## 生成输出

以下输出由 `scripts/render-assets.mjs` 使用 bundled Sharp 确定性生成。尺寸为实际编码尺寸，哈希为 SHA-256。

| 输出 | 尺寸 | SHA-256 | 渲染设置 |
| --- | --- | --- | --- |
| `theme/background.jpg` | 1920×1080 | `75f90080bcca721a2a0a41318f159b56e0723e0c90383493c03d51f535df31fc` | `background.svg`；resize 1920×1080、cover；flatten `#f7eee9`；JPEG quality 90、4:4:4 |
| `sidecar/assets/denia-old-days-bright.webp` | 1440×810 | `fa471d994e9a974159ba8a39606841371d2ebff18b3ec3a84bde2438378f0706` | `old-days-bright-102s.jpg`；resize 1440×810、cover、centre；WebP quality 88、smartSubsample |
| `sidecar/assets/denia-task-warm.webp` | 640×2000 | `97e767e03cc02df0b76b11106c1697918608823706842bb92d37e80c7b37431f` | 花园泡泡壁纸的无字近景；`245,0,346×1080`；WebP quality 86 |
| `sidecar/assets/denia-task-approval.webp` | 640×2000 | `d8e9124ad68a04021c8911819a6e21cba51b543f480a505cb3a24b98caa347a9` | 双形态竖幅的明色正脸与暗色注视；`470,220,896×2800`；WebP quality 86、smartSubsample |
| `sidecar/assets/denia-task-error.webp` | 640×2000 | `55ebb464e95001b96f6a68c5a18054e80e0764450551e4e912a4c4b525f1c8c6` | 完整无笑意正脸与抬臂动势；`1140,100,282×880`；WebP quality 86、smartSubsample |
| `sidecar/assets/denia-task-complete.webp` | 640×2000 | `8328e475e0b73cd7f94b7425b85747a228fa70f78bcf9fd267c26a175bd66bc3` | 周年贺图的无字近景；`330,100,464×1450`；WebP quality 86 |
| `evidence/home.png` | 1600×1000 | `e86c91fae29a8c68612784868881d19fca4b33487f1227acb94c1b05a676c0de` | Bright 单一画面；P2 背纸、纸纹、显影边和虹彩泡泡；PNG compressionLevel 9 |
| `evidence/home-compact.png` | 1200×800 | `2cdec02ca28303c20f6f14009d8f12e6d82b53710c00989cb78cc5dfb3228cf6` | 与宽屏首页共用 Bright 画面，只改变拍立得尺寸和裁切 |
| `evidence/task-staged.png` | 1600×1000 | `6c013fb586d4c63a4bb1b95784a1cc1c327112d0b4318400e6e563272676f3d9` | 暖日泡泡近景低透明待命态，输入框止于右栏安全区 |
| `evidence/task.png` | 1600×1000 | `7719c000b70ed5f94858ebe4bf341c756fee77c1776bc43b47ec32d27f21d3e4` | 同一暖日泡泡近景提高对比、轻微靠近工作区后的工作态，输入框止于右栏安全区 |
| `evidence/task-approval.png` | 1600×1000 | `84501cff187d8f40d480fef78e5235870ba75eb7e47867d0791faf33b7ed895a` | 双形态审批态；源图 extract `470,220,896×2800`；输入框止于右栏安全区 |
| `evidence/task-error.png` | 1600×1000 | `84e27bd6ef607523423e48cde5d3cbb392da03f052cc286dc7d21eb341c4a6ff` | 完整无笑意正脸错误态；源图 extract `1140,100,282×880`；输入框止于右栏安全区 |
| `evidence/task-working-to-approval-350ms.png` | 1600×1000 | `425d398bb5142607335ee0d9f68e387bdaebc9de265faaedfe540c8b199ed5d2` | Working→Approval 350ms 受控过渡；Approval 源图 extract `470,220,896×2800` |
| `evidence/task-error-to-complete-500ms.png` | 1600×1000 | `bf3ae02c230c529b64b62f9ba266fef19e37b82d5228693480b6233749a12d2c` | Error→Complete 500ms 受控过渡；Error 源图 extract `1140,100,282×880` |
| `evidence/task-complete.png` | 1600×1000 | `978d6a9657abb4261c21d02ddbbe9711a5f7426ac138ddd1c28174fcee159246` | 无周年宣传字样的完成态近景，右下链饰区域覆轻纸雾，输入框止于右栏安全区 |

## 2026-07-23 视觉复核

- 七张首页与任务截图均无宣传文字、Logo 或多图叠放污染。
- `staged`、`working`、`complete` 保持暖亮形态；`approval`、`error` 限定为严肃暗形态。
- 审批与错误使用独立官方图：审批保留明暗双形态等待感，错误优先保全无笑意正脸并保留抬臂动势；错误不使用 glitch、抖动或额外文字。
- 右栏与工作区保持单向纸雾过渡，但不参与原生工作区、分栏或输入框布局；窄屏隐藏。
- UI/UX 审查无 P0；完成两项 P1 微调后进入本地小范围体验测试。
