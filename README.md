# Denia Old Days Codex Theme

`denia-old-days@0.1.0` 是达妮娅《旧日斑斓》双形态学院手账 Codex Dream Skin 的独立源码仓库。

## 目录

- `art/source/`：原创 SVG 与经哈希固定的官方视觉源文件。
- `theme/`：portable Light Base Theme。
- `sidecar/`：可卸载的 `cdp-loopback-v1` Canonical Sidecar。
- `evidence/`：本地验证结果和脱敏预览输入。
- `canon/`：设定参考与素材来源。

生成的运行时 WebP 衍生图和本地验证 JSON 不纳入 Git。构建 Registry 包之前必须重新生成并校验。

## 官方素材来源与使用

- 首页剧情特例：库洛官方《旧日斑斓》动画约 `00:01:42` 帧，1920×1080。
- 任务暖色侧栏：官方发布的花园泡泡壁纸，使用正脸、猫与泡泡所在的无字裁切。
- 审批侧栏：官方周年双形态竖幅贺图，保留明色正脸与上方暗色注视，表达等待用户决定。
- 错误侧栏：官方周年插画展发布图，优先保留完整无笑意正脸与抬臂动势，表达秩序失衡。
- 完成侧栏：官方二周年贺图，运行版只使用不含底部周年标题的近景裁切。
- 宽幅场景：官方二周年双形态插画保持完整横向关系，不强裁成窄侧栏。

角色 PV 和战斗演示不再作为主题素材来源。《旧日斑斓》只保留为已经确认的首页剧情例外。

本项目仅作内部非官方粉丝主题使用，不主张对官方素材的所有权或再分发许可，也不隶属于、不受 OpenAI、库洛游戏或《鸣潮》权利方认可或赞助。上传 Kaboo Registry 前仍需逐项确认素材分发要求。Codex 运行时只使用包内 WebP 衍生图，不发起远程请求。

## 命令

```bash
npm ci
node scripts/check-source.mjs
node sidecar/tests/validate.mjs sidecar
npm run build:kaboo
```

完整的 Kaboo 本地包生成在 `sidecar/release/kaboo-local/`。本地安装使用 Kaboo 的正式离线入口；Kaboo 会物化其内嵌、版本固定的 Dream Skin runtime，不需要另一个 Studio 源码仓库，也不会访问 Registry、CDN、发布接口或自动更新服务：

```bash
kaboo-cli codex-theme install-local sidecar/release/kaboo-local/denia-old-days/0.1.0/catalog-version.json
kaboo-cli codex-theme verify denia-old-days
```

如果安装结果为 `prepared`，按 CLI 提示显式执行 `kaboo-cli codex-theme activate --restart`；主题仓库不会自行启动或重启 ChatGPT。

运行时不读取网络素材，不修改 Codex.app、`app.asar`、签名、账户、模型或 API 配置。
