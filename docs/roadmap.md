# Roadmap（桌面 v1 之后）

wayfinder 地图「从 Lynx 迁移到 Tauri」(#2) 已关闭，桌面 v1 功能集与全部决策定案。
以下为 v1 后的后续里程碑；每个里程碑启动时另开独立 effort（新 wayfinder 地图）。

## 源运行时系统（v1 后首个里程碑，grilling #11 定）

> 本里程碑的 wayfinder 地图（[wayfinder: 源运行时系统（JS 源脚本 + rquickjs + 远程源仓库）](https://github.com/fw6/comic/issues/12)）已于 2026-08-15 定案关闭并**实现落地**：webtoons/mangadex 迁为首批源脚本（`desktop/crates/cimoc-core/src/js/sources/`，rquickjs 0.12.2 执行）、crawl 接线（buildUrl → Rust 抓取 → parse）、Settings 源管理（检查更新/sha256 校验/应用）、Sources 错误行、公开源仓库 [fw6/cimoc-sources](https://github.com/fw6/cimoc-sources)（`sources.json` v1）上线。加源 = 提交一份脚本到源仓库。

- 源 = 运行时加载的 JS 脚本，在 Rust 核心的 rquickjs（QuickJS）嵌入运行时执行；
  网络/Referer/缓存/热链代理留在 Rust 原生层（webview fetch 设不了头，research #4）。
- 远程源仓库分发：index JSON（源元数据 + 版本 + sha256 校验）、app 内手动检查更新；
  签名体系后置（社区化时再上）。
- webtoons / mangadex 迁为首批源脚本，逐源删除 Rust 解析（op 协议不变，fixture 复用，测试走 vitest）。
- 期间加源 = 发版（接受的暂时窗口）。

## 离线阅读（已下载/本地漫画的阅读）

> 已实现（2026-08-15，[wayfinder 地图 #18](https://github.com/fw6/comic/issues/18)）：下载目录改为 `<dir>/<source>/<comicId>/…` 命名空间；Library「下载/本地」tab 点漫画就地展开章节 → 本地阅读器（`/local`，Reader local 模式，图片经 `cimoc-img://` file 模式渲染，全程无网络）；「本地」tab 兼容旧扁平导入（source 记 `"local"`）；进度与在线共用 (source, comicId) 键。

## 移动里程碑（桌面 v1 后，grilling #3/#6 定）

- 功能集 = 桌面 v1 同一套；验收 = 核心阅读路径真机跑通。
- 首周真机 spike：webview 图片表现与滚动性能。
- FCM 推送 + 后台下载需自定义 Kotlin/Swift 插件（预算 2–4 周）；自动更新走应用商店。

## e2e（tauri-driver）

- v1 不建（grilling #10 定）；功能集稳定、回归频繁时评估引入。

## 下载任务队列（多任务下载进度管理界面）

> **已实现**（2026-08-15，[wayfinder 地图 #20](https://github.com/fw6/comic/issues/20)）：下载从 Reader 内联逐页串行升级为 **Rust 侧常驻队列 + IPC Channel 推送进度**（`Mutex<DownloadQueue>` 入 State，setup spawn 2 个 worker，每页 `spawn_blocking(cimoc_core::download_image)`）+ TopBar「下载」管理页。任务粒度 = 一话（taskId = `source/comicId/chapterIndex`）；全局 2 页并发、章内顺序；状态 queued/downloading/done/failed/cancelled，单页重试 2 次；去重 = 已在磁盘入队即 done；内存态不持久化；Reader「下载本话」改入队 + 轻提示；批量入口（Detail 下载全部/多选）后置。研究纪要：`docs/research/tauri-progress-push.md`。

## 其它后置项（grilling #6 定）

- WebDAV 备份/恢复（收藏/历史/进度；v1.1 起也是旧手机数据互通的通道）——**已实现**（2026-08-15，[wayfinder 地图 #24](https://github.com/fw6/comic/issues/24)）：设置页「WebDAV 备份」段（地址/账号/密码 + 备份/恢复 + 确认弹窗）；单文件 `cimoc-backup.json` 内聚 `{version:1, exportedAt, favorites, history, progress}`；恢复整体覆盖三域，version≠1 拒绝；复用 core `webdav_put/get`（Basic Auth）。自动定时备份、钥匙串加密后置。
- 发布强化：正式签名/公证（macOS Developer ID + notarytool）、自动更新（tauri-updater，
  需 tauri signer + CI secrets；research #9 事实）。
