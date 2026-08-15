# Roadmap（桌面 v1 之后）

wayfinder 地图「从 Lynx 迁移到 Tauri」(#2) 已关闭，桌面 v1 功能集与全部决策定案。
以下为 v1 后的后续里程碑；每个里程碑启动时另开独立 effort（新 wayfinder 地图）。

## 源运行时系统（v1 后首个里程碑，grilling #11 定）

> 本里程碑的 wayfinder 地图已开：[wayfinder: 源运行时系统（JS 源脚本 + rquickjs + 远程源仓库）](https://github.com/fw6/comic/issues/12)。

- 源 = 运行时加载的 JS 脚本，在 Rust 核心的 rquickjs（QuickJS）嵌入运行时执行；
  网络/Referer/缓存/热链代理留在 Rust 原生层（webview fetch 设不了头，research #4）。
- 远程源仓库分发：index JSON（源元数据 + 版本 + sha256 校验）、app 内手动检查更新；
  签名体系后置（社区化时再上）。
- webtoons / mangadex 迁为首批源脚本，逐源删除 Rust 解析（op 协议不变，fixture 复用，测试走 vitest）。
- 期间加源 = 发版（接受的暂时窗口）。

## 离线阅读（已下载/本地漫画的阅读）

- 现状：Library 下载/本地 tab 仅列表（comicId + 章节目录数），无法阅读。
- 需要：本地源的阅读路径（cimoc-core 增加 local source，或 fs 权限渲染本地文件）；
  下载目录带 source 命名空间（当前 `<dir>/<comicId>/...` 无法反查源，跨源同 id 会撞目录）。
- 依赖：源运行时系统落地后，「本地源」可作普通源实现，自然复用阅读器。

## 移动里程碑（桌面 v1 后，grilling #3/#6 定）

- 功能集 = 桌面 v1 同一套；验收 = 核心阅读路径真机跑通。
- 首周真机 spike：webview 图片表现与滚动性能。
- FCM 推送 + 后台下载需自定义 Kotlin/Swift 插件（预算 2–4 周）；自动更新走应用商店。

## e2e（tauri-driver）

- v1 不建（grilling #10 定）；功能集稳定、回归频繁时评估引入。

## 其它后置项（grilling #6 定）

- 下载任务队列（多任务下载进度管理界面）。
- WebDAV 备份/恢复（收藏/历史/进度；v1.1 起也是旧手机数据互通的通道）。
- 发布强化：正式签名/公证（macOS Developer ID + notarytool）、自动更新（tauri-updater，
  需 tauri signer + CI secrets；research #9 事实）。
