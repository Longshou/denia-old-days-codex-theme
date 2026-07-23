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

## 任务状态美术

| Codex 状态 | 美术与处理 |
| --- | --- |
| `staged` | 暖色花园泡泡图，低强度等待 |
| `working` | 同一暖色图，提高对比并轻微靠近工作区 |
| `approval` | 严肃暗色正脸，柔紫色确认语气 |
| `error` | 同一暗色图拉近、加深，并使用克制的洋红分界 |
| `complete` | 明快直视近景，右下细节覆轻纸雾 |

任务页使用固定右侧双层美术栏。跨图状态通过 `opacity`、`transform` 和 `filter` 交叉过渡；同图状态只改变强度，不重复闪烁。美术栏在窄于 `920px` 时隐藏，并支持“减少动态效果”和“减少透明度”系统偏好。

## 本地体验交付

构建本地包：

```bash
bash package.sh
```

只安装、不启动：

```bash
scripts/install.sh --no-start
```

当 Dream Skin Studio 的 Codex 调试端口已经启用后：

```bash
scripts/start.sh
scripts/verify.sh
```

`start.sh` 不会擅自重启正在运行的 Codex。若调试端口尚未启用，需要先退出 Codex，再通过 Dream Skin Studio 启动，或由用户明确授权其重启流程。
