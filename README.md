# Denia Old Days Codex Theme

`denia-old-days@0.1.0` 是达妮娅《旧日斑斓》双形态学院手账 Codex Dream Skin 的独立源码仓库。

## 目录

- `art/source/`：原创 SVG 视觉源文件。
- `theme/`：portable Light Base Theme。
- `sidecar/`：可卸载的 `cdp-loopback-v1` Canonical Sidecar。
- `evidence/`：本地验证结果和脱敏预览输入。
- `canon/`：设定参考与素材来源。

生成的 JPEG、WebP、PNG 和本地验证 JSON 不纳入 Git。构建 Registry 包之前必须重新生成并校验。

## 命令

```bash
KABOO_SHARP_ENTRY=/absolute/path/to/sharp/lib/index.js node scripts/render-assets.mjs
node scripts/check-source.mjs
node sidecar/tests/validate.mjs sidecar
```

运行时不读取网络素材，不修改 Codex.app、`app.asar`、签名、账户、模型或 API 配置。

