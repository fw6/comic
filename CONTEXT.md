# CONTEXT.md — Cimoc

Cimoc 漫画阅读器的领域术语表。桌面 v1（Tauri v2 + React）先落地，移动端（iOS/Android）为后置里程碑，术语跨端共享。术语来源：原 Lynx 产品的 Cimoc 约定 + wayfinder grilling #6 定案（2026-08-15）。

## 术语

- **漫画源（source）**：提供漫画内容的站点（如 webtoons、mangadex）。每个源有自己的爬虫规则与标识（sourceId）。
- **爬虫（crawl）**：按源规则抓取列表 / 详情 / 章节 / 图片的引擎，驻留 Rust 核心（cimoc-core）。
- **漫画（comic）**：一部作品，以（source, comicId）唯一标识。
- **章节（chapter）**：漫画的一个话。源内以序号 chapterIndex 标识；同一作品的章节按章序排列。
- **外链章节（external chapter）**：images 为空、内容托管在站外的章节（如 MangaDex 上指向 MangaPlus 的章节）。一律过滤：不出现在章节列表，也不进入「下一话」；只有外链章节的书显示空态。桌面 v1 不做跳浏览器等任何外链处理。
- **无限滚动（infinite scroll，又称卷纸流）**：阅读器的唯一阅读形态——章节内连续滚动，滚到话末自动加载下一话，跨话连续阅读。
- **阅读模式（reading mode）**：已无此概念。翻页模式自桌面 v1 起废弃，不存在模式切换；「默认阅读模式」设置项随之删除。
- **进度（progress）**：读者的阅读位置，由应用自动记录（当前章节 + 话内位置），阅读时静默落盘，重进阅读器恢复。不提供手动保存。
- **收藏（favorites）**：用户收藏的漫画列表。
- **历史（history）**：最近阅读记录。
- **下载（download）**：把章节图片保存到本地，目录约定为「下载目录/<comic>/<chapter>/<page>」；下载行为在 Reader 内触发。
- **下载任务（download task）**：多任务下载队列的进度管理界面（v1 后置）。
- **本地扫描（local scan）**：用户选择一个文件夹，导入其中已下载的漫画（Library「本地」入口）。
- **WebDAV 备份（backup）**：收藏 / 历史 / 进度的 WebDAV 备份与恢复（v1 后置；也是日后旧手机数据互通的通道）。
