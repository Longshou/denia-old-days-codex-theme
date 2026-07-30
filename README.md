# 达妮娅 · 旧日斑斓 Codex Theme

`denia-old-days@0.1.0` 是一套 macOS 版 Codex 完整主题。浅色首页使用暖色拍立得构图，深色首页切换为全景画面；任务页会随工作、审批、错误和完成状态改变右侧美术。

![首页预览](previews/home.webp)

![任务页预览](previews/task.webp)

## 安装前只做一件事

先安装公开的 [Codex Dream Skin](https://github.com/Fei-Away/Codex-Dream-Skin/releases/latest)，打开一次并完成引擎安装。

- 已安装 Codex Desktop，并至少打开过一次。
- 支持 Apple Silicon 和 Intel Mac。
- 普通用户不需要安装 Node.js、npm 或开发工具。
- 本安装包不内置、不修改 Codex Dream Skin 引擎。
- 安装时 Dream Skin 可能重启 Codex，请先保存未发送的输入。

上游应用被 macOS 拦截时，按其 [官方 README](https://github.com/Fei-Away/Codex-Dream-Skin#readme) 的 macOS 安装说明处理。不要执行来源不明的签名绕过命令。

## 方法一：下载后双击

1. 从本项目的 [Releases](https://github.com/Longshou/denia-old-days-codex-theme/releases/latest) 下载 `denia-old-days-macos.zip`。
2. 双击 ZIP 解压。
3. 打开 `Denia Old Days` 文件夹。
4. 双击 `Install Denia Old Days.command`。
5. 看到“安装完成”后关闭终端窗口。

如果 macOS 不允许直接打开 `.command`，右键文件，选择“打开”。也可以使用下面的一条命令。

## 方法二：复制一条命令

打开“终端”，完整复制并回车：

```bash
curl -fsSL https://raw.githubusercontent.com/Longshou/denia-old-days-codex-theme/main/installer/bootstrap-macos.sh | /bin/bash
```

这条命令下载最新 Release，运行同一个安装入口，结束后删除临时文件。

## 安装内容

- 基础主题保存到 Codex Dream Skin 的主题库。
- 完整动态效果安装到：

```text
~/Library/Application Support/CodexDreamSkinExtensions/denia-old-days/
```

- 安装器会保存原来的主题。卸载时优先恢复原主题。
- 不修改 `Codex.app`、应用签名、账号、模型、API 配置。
- 运行时只连接本机 `127.0.0.1`，素材全部来自安装包。

## 查看状态

复制到终端：

```bash
"$HOME/Library/Application Support/CodexDreamSkinExtensions/denia-old-days/package/scripts/status.sh"
```

`verified=true` 表示当前 Codex 页面已加载完整效果。安装使用的 `sidecar/scripts/health.sh` 只检查当前页面，不切换任务、不改变窗口尺寸。

## 卸载

保留下载文件时，双击：

```text
Uninstall Denia Old Days.command
```

下载文件已经删除时，复制到终端：

```bash
"$HOME/Library/Application Support/CodexDreamSkinExtensions/denia-old-days/uninstall/Uninstall Denia Old Days.command" --no-pause
```

卸载会删除达妮娅基础主题、动态效果和本包状态，并恢复安装前的主题。Codex Dream Skin 引擎和其他主题会保留。

## 常见问题

### 提示“没有找到 Codex Dream Skin 引擎”

安装并打开一次 [Codex Dream Skin](https://github.com/Fei-Away/Codex-Dream-Skin/releases/latest)，然后重新运行安装命令。

### 安装完成，但当前页健康检查暂时未通过

安装不会因此失败。打开 Codex，等待页面出现后再运行“查看状态”命令。

### 只有背景，没有任务状态和右侧美术

从 Codex Dream Skin 菜单重新应用当前主题，再运行一次安装器。完整效果由基础主题和 Sidecar 两层组成。

### 深度探针提示没有任务或页面不稳定

`sidecar/scripts/verify.sh` 是维护者使用的四场景布局检查，会主动切换首页、任务页和窗口尺寸。它不参与普通安装。需要运行时，先打开一个已有 Codex 任务：

```bash
"$HOME/Library/Application Support/CodexDreamSkinExtensions/denia-old-days/package/scripts/verify.sh"
```

### Codex 更新后样式错位

先更新 Codex Dream Skin，再重新安装本主题。若仍有问题，请在 GitHub Issue 中附上 Codex 版本、Dream Skin 版本和状态命令输出。

## 开发与打包

开发者需要 Node.js 20 或更高版本：

```bash
npm ci
npm run check
npm run build:release
npm run check:release
```

发布物位于：

```text
release/denia-old-days-macos.zip
```

`npm run check` 会重新生成素材，检查源码和 Sidecar，并运行安装器与 GitHub 发布契约测试。`npm run check:release` 会解压 ZIP，复核路径、执行权限、版本、`SHA256SUMS` 和 Sidecar 协议。

## 目录

```text
art/source/   固定素材输入
canon/        素材来源与视觉设定
installer/    一键安装、卸载和在线引导
previews/     GitHub 预览图
scripts/      素材生成、测试和发布构建
sidecar/      动态组件层、运行时与布局合同
theme/        Codex Dream Skin 基础主题
```

代码许可见 [LICENSE](LICENSE)。第三方美术的来源和权利说明见 [素材来源记录](https://github.com/Longshou/denia-old-days-codex-theme/blob/main/canon/sources.md) 与 [sidecar/NOTICE.md](sidecar/NOTICE.md)。
