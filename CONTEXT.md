# CONTEXT.md — Cimoc

Cimoc 漫画阅读器的领域术语表。桌面 v1（Tauri v2 + React）先落地，移动端（iOS/Android）为后置里程碑，术语跨端共享。术语来源：原 Lynx 产品的 Cimoc 约定 + wayfinder grilling #6 / #11 定案（2026-08-15）。

## 术语

- **漫画源（source）**：提供漫画内容的站点（如 webtoons、mangadex、copymanga、dongman、manhuagui）。每个源 = 一个运行时加载的爬虫脚本模块（执行于 Rust 核心的嵌入 JS 运行时），定义 URL 构造、解析规则、请求头与热链域名，以 sourceId 标识，经源仓库分发更新（grilling #11 定案）。
- **源仓库（source repository）**：分发源脚本的公开远程索引——单一 index.json，每个源条目内嵌脚本源码 + 元数据 + 递增整数版本 + sha256 校验；app 内手动检查更新（版本对比、sha256 校验通过后原子替换已装源）。签名体系后置（grilling #16 定案）。
- **已装源（installed source）**：app 内已安装、可用的源；内置源（webtoons/mangadex/copymanga/dongman/manhuagui）随 app 内置，版本独立于 app 版本，经源仓库手动更新。源管理入口在设置（列表 / 检查更新 / 应用更新；grilling #16 定案）。
- **爬虫（crawl）**：按源规则抓取列表 / 详情 / 章节 / 图片的引擎。网络取数（文本/JSON/字节，带 Referer/UA）、磁盘缓存与热链图片代理驻留 Rust 核心（cimoc-core）；解析规则在源脚本中（v1 后按 grilling #11 迁移，v1 期间解析暂留 Rust）。
- **漫画（comic）**：一部作品，以（source, comicId）唯一标识。
- **章节（chapter）**：漫画的一个话。源内以序号 chapterIndex 标识；同一作品的章节按章序排列。
- **外链章节（external chapter）**：images 为空、内容托管在站外的章节（如 MangaDex 上指向 MangaPlus 的章节）。一律过滤：不出现在章节列表，也不进入「下一话」；只有外链章节的书显示空态。桌面 v1 不做跳浏览器等任何外链处理。
- **无限滚动（infinite scroll，又称卷纸流）**：阅读器的唯一阅读形态——章节内连续滚动，滚到话末自动加载下一话，跨话连续阅读。
- **阅读模式（reading mode）**：已无此概念。翻页模式自桌面 v1 起废弃，不存在模式切换；「默认阅读模式」设置项随之删除。
- **进度（progress）**：读者的阅读位置，由应用自动记录（当前章节 + 话内位置），阅读时静默落盘，重进阅读器恢复。不提供手动保存。
- **收藏（favorites）**：用户收藏的漫画列表。
- **历史（history）**：最近阅读记录。
- **下载（download）**：把章节图片保存到本地，目录约定为「下载目录/<source>/<comic>/<chapter>/<page>」（wayfinder #19 命名空间，跨源同 id 不撞目录）；Reader「下载本话」把章节**入队**（wayfinder #20/#22），由 Rust 侧队列 worker 按章内顺序、全局 2 页并发下载，进度经 IPC Channel 推送（`download://progress`）。已下载漫画在 Library「下载/本地」tab 离线阅读（/local 本地阅读器，图片经 cimoc-img:// 本地模式渲染）。
- **下载任务（download task）**：多任务下载队列（wayfinder #20 已实现）：一话一个任务，taskId = `source/comicId/chapterIndex`；状态 queued/downloading/done/failed/cancelled；单页失败重试 2 次；去重 = 已在磁盘入队即 done；内存态不持久化；TopBar「下载」页管理（进度条/取消/重试/清空已完成）。
- **本地扫描（local scan）**：用户选择一个文件夹，导入其中已下载的漫画（Library「本地」入口）。
- **自动更新（auto-update）**：Windows/Linux 的 tauri-updater 自动更新（wayfinder #26 已实现；**不发 macOS 端**）：设置页「检查更新」→ 下载（进度）→「重启安装」；tauri signer 密钥对（公钥在 tauri.conf.json `plugins.updater.pubkey`，私钥在 CI secret `TAURI_SIGNING_PRIVATE_KEY`）；endpoint 为 GitHub Releases 的 latest.json；发布走 release.yml（draft release，人工核验后 publish）。
- **WebDAV 备份（backup）**：收藏 / 历史 / 进度的 WebDAV 备份与恢复（wayfinder #24 已实现；也是日后旧手机数据互通的通道）：单文件 `cimoc-backup.json` 内聚 `{version, exportedAt, favorites, history, progress}`，设置页「WebDAV 备份」段配置地址/账号/密码（明文存 settings，钥匙串后置）；恢复整体覆盖三域、version≠1 拒绝；传输复用 core `webdav_put/get`（Basic Auth）。
