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

- Bright：库洛官方《旧日斑斓》动画约 `00:01:42` 帧，1920×1080，SHA-256 `d0989c926a8dcb8033c21e781fc6c99a5d6e550d3233dac2789ca688e9c7f1dd`。
- Dark：库洛官方达妮娅横版海报，1840×1080，SHA-256 `1a5fc296eba320eff8fcab37be15fd017dce4b682ce4a4695c2dabbe1e54e6b1`。
- Compact：库洛官方达妮娅透明立绘，1186×1844，SHA-256 `95ad359595edc790084194504dbbd7a5245c6428b9ec78a1aca4dc7bab994245`。

本项目仅作内部非官方粉丝主题使用，不主张对官方素材的所有权或再分发许可，也不隶属于、不受 OpenAI、库洛游戏或《鸣潮》权利方认可或赞助。Codex 运行时只使用包内 WebP 衍生图，不发起远程请求。

## 命令

```bash
KABOO_SHARP_ENTRY=/absolute/path/to/sharp/lib/index.js node scripts/render-assets.mjs
node scripts/check-source.mjs
node sidecar/tests/validate.mjs sidecar
```

运行时不读取网络素材，不修改 Codex.app、`app.asar`、签名、账户、模型或 API 配置。
