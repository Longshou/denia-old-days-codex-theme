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
| `approval` | 官方双形态竖幅，保留明色正脸和上方暗色注视，以柔紫色表达确认语气 |
| `error` | 独立的官方周年插画展图，优先保留完整无笑意正脸与抬臂动势，并使用克制的洋红分界 |
| `complete` | 明快直视近景，右下细节覆轻纸雾 |

任务页使用不参与布局的固定右侧双层美术栏。跨图状态通过 `opacity`、`transform` 和 `filter` 交叉过渡；同图状态只改变强度，不重复闪烁。美术栏位于原生任务界面之后，不修改工作区、分栏或输入框几何尺寸；窄于 `920px` 时隐藏，并支持“减少动态效果”和“减少透明度”系统偏好。

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
