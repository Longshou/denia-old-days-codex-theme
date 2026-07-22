# 达妮娅 · 旧日斑斓 Sidecar

这是 `denia-old-days@0.1.0` 的 Canonical Sidecar。它通过 Dream Skin Studio 已存在的 `127.0.0.1` CDP 端点连接 `app://-/index.html`，只注入包作用域内的样式、装饰节点和原生动作代理。

## 本地检查

```bash
node tests/validate.mjs .
scripts/start.sh
scripts/status.sh
scripts/verify.sh
scripts/stop.sh
```

Sidecar 不发起远程请求，不读取模型凭据，不修改 Codex.app、`app.asar` 或代码签名。卸载只删除本包管理的状态和文件。
