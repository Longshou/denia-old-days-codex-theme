# 素材清单

`scripts/render-assets.mjs` 只读取本页列出的固定输入。源文件、生成参数和
SHA-256 共同定义 `denia-old-days@0.1.2` 的视觉产物。

## 输入文件

| 文件 | 尺寸 | SHA-256 | 来源 |
| --- | ---: | --- | --- |
| `art/source/background.svg` | 1920×1080 | `1169ea2d6968951d73fff3a25c7aec8c4519537d4e564e7b2c44374d4376ae06` | 项目源文件 |
| `art/source/task-preview.svg` | 1600×1000 | `79a6b9698cacca28c58c9165ad69074c5bbd92a8866df512a93b41e35ea8b53e` | 项目源文件 |
| `art/source/official/old-days-bright-102s.jpg` | 1920×1080 | `d0989c926a8dcb8033c21e781fc6c99a5d6e550d3233dac2789ca688e9c7f1dd` | [《旧日斑斓》](https://www.kurobbs.com/mc/post/1507356224033308672) |
| `art/source/official/denia-home-dark-hjz.jpg` | 4096×2304 | `b4d5f5b17b83c0f855e8d09effadc01fdead43d01fb6c03b42c3f34860fe17ce` | [达妮娅插画索引](https://wikiwiki.jp/w-w/%E3%83%80%E3%83%BC%E3%83%8B%E3%83%A3#official_illust) |
| `art/source/official/denia-garden-bubbles-warm.jpg` | 1920×1080 | `481bf5ff8fa4f54d5b696f6144fb3f6a7d3b2d8b580cf2a5baee39409110489b` | [达妮娅插画索引](https://wikiwiki.jp/w-w/%E3%83%80%E3%83%BC%E3%83%8B%E3%83%A3#official_illust) |
| `art/source/official/denia-approval-dual-form.jpg` | 1871×3327 | `3339a65536eb6b8cff762f4ac441df6358e857c8b25f0ddaecbade8e457f84c0` | [达妮娅插画索引](https://wikiwiki.jp/w-w/%E3%83%80%E3%83%BC%E3%83%8B%E3%83%A3#official_illust) |
| `art/source/official/denia-error-reaching.jpg` | 1920×1080 | `42c2a49b83de911a01627501875e6df992ac26da556c90b2c64433883eb353f4` | [达妮娅插画索引](https://wikiwiki.jp/w-w/%E3%83%80%E3%83%BC%E3%83%8B%E3%83%A3#official_illust) |
| `art/source/official/denia-anniversary-direct-gaze.jpg` | 1080×1920 | `dea27e716f9561131e2b5255ea60a84de2512e8e81886073f09c64e02739fc6e` | [二周年贺图](https://x.com/WW_JP_Official/status/2049081192532557960) |
| `art/source/official/denia-dark-form-smile-closeup.png` | 1080×1920 | `1dcbfa127968c2386ad77da325f850ad4985bccc95959d915652df36dcba2296` | [Stars Intertwined — Denia](https://x.com/Wuthering_Waves/status/2037002852649099578) |
| `art/source/official/denia-right-sidebar-wide.jpg` | 1840×1080 | `d312c86f21610d7d6b50b8d8fa9b9685ef4baa11d34c0ca72fd71a712bfa42ed` | [达妮娅插画索引](https://wikiwiki.jp/w-w/%E3%83%80%E3%83%BC%E3%83%8B%E3%83%A3#official_illust) |

## 生成文件

| 文件 | 尺寸 | SHA-256 |
| --- | ---: | --- |
| `theme/background.jpg` | 1920×1080 | `75f90080bcca721a2a0a41318f159b56e0723e0c90383493c03d51f535df31fc` |
| `sidecar/assets/denia-old-days-bright.webp` | 1440×810 | `fa471d994e9a974159ba8a39606841371d2ebff18b3ec3a84bde2438378f0706` |
| `sidecar/assets/denia-home-dark.webp` | 2048×1152 | `24590e16aebd09dd2ce730d3302e3b58b2d271e62f295485a32e23f1a8ce5b0c` |
| `sidecar/assets/denia-right-sidebar.webp` | 640×1600 | `2f26b9623ad2df363479ee9c6895a718b7e8f158ed3bc65d747b9bebd386231c` |
| `sidecar/assets/denia-right-sidebar-wide.webp` | 1840×1080 | `30b632c8d45f12e757d6be96dd07e18b7aba2e53beb4541bae755fa75fb6e629` |
| `sidecar/assets/denia-task-warm.webp` | 640×2000 | `97e767e03cc02df0b76b11106c1697918608823706842bb92d37e80c7b37431f` |
| `sidecar/assets/denia-task-approval.webp` | 640×2000 | `d8e9124ad68a04021c8911819a6e21cba51b543f480a505cb3a24b98caa347a9` |
| `sidecar/assets/denia-task-error.webp` | 640×2000 | `55ebb464e95001b96f6a68c5a18054e80e0764450551e4e912a4c4b525f1c8c6` |
| `sidecar/assets/denia-task-complete.webp` | 640×2000 | `8328e475e0b73cd7f94b7425b85747a228fa70f78bcf9fd267c26a175bd66bc3` |
| `previews/home.webp` | 1600×1000 | `3ecdb143c4e3a64a09317182754722461d5d23b14e8947a7dc8b1aa4ff27971c` |
| `previews/task.webp` | 1600×1000 | `143a54e024e4dc5f0830406cbbd61700c5a7023a1c151104df4623006312784d` |

## 生成参数

- `theme/background.jpg`：JPEG quality 90，4:4:4。
- 首页明色图：WebP quality 88。
- 首页暗色图：WebP quality 80。
- 右侧栏与任务状态图：WebP quality 84～86。
- GitHub Release 预览：1600×1000，WebP quality 82，effort 6。
