# 达妮娅 · 旧日斑斓 Sidecar

这是 `denia-old-days@0.1.2` 的动态组件层。它使用 Codex Dream Skin 已启用的本机 CDP 端点连接经过页面身份检查的 Codex renderer，注入包内样式、装饰节点和本地美术。首选地址是 `app://-/index.html`，同时兼容上游后续的 `app://` 页面变体。

普通用户使用根目录的 `Install Denia Old Days.command`，不需要单独操作本目录。

## 运行边界

- 只连接 `127.0.0.1` 上由 Codex Dream Skin 提供的端口。
- 不发起远程素材请求。
- 不读取账号、模型或 API 凭据。
- 不修改 `Codex.app`、`app.asar` 或代码签名。
- 卸载只删除本包管理的文件和状态。
- 需要 Node.js 22 或更高版本，并使用原生 WebSocket。

## 本地检查

```bash
node tests/validate.mjs .
scripts/start.sh
scripts/status.sh
scripts/health.sh
scripts/stop.sh
```

`health.sh` 只检查当前页面是否完成注入。它不会跳转页面或模拟窗口尺寸。

`status.sh` 只读取进程和本地状态文件。`runtimeStatus=waiting` 表示没有已注入的页面；`connected=true` 表示运行记录中至少有一个已注入的页面，仍需 `health.sh` 确认当前页面。

断开连接时，重试间隔从 500 毫秒逐步增加到 30 秒。重复错误限频为每 5 分钟一次；未变化的状态不重复写入文件。日志超过 1 MiB 时保存末尾 256 KiB 到 `loader.log.previous`，并在原文件上截断，保留 launchd 的输出连接。

## 深度布局检查

```bash
scripts/verify.sh
```

`verify.sh` 按 `layout-contract.json` 检查桌面和窄屏的首页、任务页。运行前需要在 Codex 中保留至少一个可打开的任务。这个检查用于发布前维护，不阻止普通安装。

## 任务状态美术

| Codex 状态 | 美术 |
| --- | --- |
| `staged` | 暖色花园泡泡图 |
| `working` | 暖色图的高对比工作态 |
| `approval` | 双形态竖幅 |
| `error` | 周年插画展图 |
| `complete` | 明快直视近景 |

任务页使用固定右侧双层美术栏，不改动工作区、分栏或输入框尺寸。窄于 `920px` 时隐藏，并遵循“减少动态效果”和“减少透明度”系统设置。

## 单独安装

维护者可以运行：

```bash
scripts/install.sh --no-start
scripts/start.sh
scripts/health.sh
```

CDP 端点未启用时，后台进程会等待连接。先从 Codex Dream Skin 应用当前主题，再检查状态。停止后台进程不依赖 Node；如果页面清理所需的运行时不可用，可重启 Codex 移除残留装饰。
