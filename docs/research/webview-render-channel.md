# 隐藏 webview 渲染通道（Cloudflare / 自建验证防护源，2026-09-30）

背景：包子漫画（baozimh）在 2026-08 的加源调研里被放弃——`cn.baozimh.com` 的 search/classify/详情
301 到 `tw.baozimh.com`，普通 HTTP 客户端过不了验证页。本次为这类「JS 挑战 / 客户端环境校验」
防护源新增**隐藏 webview 渲染通道**：不可见 webview 加载目标 URL，等验证自动完成、页面渲染好后
取回完整 HTML，交给与普通抓取完全相同的源脚本 parse 契约。

## 方案

- **cimoc-core**（`crawler/render.rs`）：注册式渲染钩子。`render::needed(source)` 声明按源走渲染
  （当前 baozimh）；`script.rs::fetch` 对渲染源整源改经 `render::fetch`。宿主未注册时返回
  「渲染通道未注册」错误，由 `record_error` 呈现到前端错误行（cimoc-core 单独跑测试不依赖 webview）。
- **src-tauri**（`src/render.rs`）：隐藏 webview 渲染服务，setup 时经 `render::init` 注册进 cimoc-core。
  - 单例不可见窗口（label `render`，1280x800，`visible(false)`），懒创建；主窗口销毁时连带销毁，
    保持「关掉全部窗口即退出」的原有行为。
  - 每次渲染先导航回 `about:blank` 再导航目标：目标加载恒为全新跨文档导航，页面就绪判定用
    `location.href` + `document.readyState`（`eval_with_callback` 取回，远程页面零 IPC 权限，
    capability 不覆盖 render 窗口）。
  - 验证页等待：每 500ms 探测状态，Challenge 页（Cloudflare「Just a moment」/turnstile 容器，
    以及 baozimh tw 域自建的 proof-of-work `__gatekeeper_challenge`）等其自动跳转；
    Cloudflare 1020 拒绝页立即报错；连续两次干净检查后取 `document.documentElement.outerHTML`。
  - 诊断：`CIMOC_RENDER_TRACE=1` 环境变量把每轮状态与 eval 结果打到 stderr。
- **探针**（`src-tauri/examples/render_probe.rs`）：live 验证与 fixture 采集。
  - `dump <url> <outfile>` 渲染单页写文件；
  - `crawl <source> <op> <payload>` 走 crawl 全链路；
  - `chain <source> <comicId> <chapterIndex>` 同进程 detail → images（验证进程内缓存）。

## 关键实现要点（踩过的坑）

1. **macOS 上 `on_page_load` 事件在跨站重定向时会丢**：`cn.baozimh.com → tw → 镜像域` 的纯 302 链
   一条 Finished 事件都不发（带 JS 挑战的多文档流程正常）。导航就绪判定不能依赖该事件，改用
   `location.href` 变化 + `about:blank` 复位。
2. **`readyState` 可能永远不到 `complete`**：阅读器页有挂起的统计/广告子资源。判据接受
   `interactive`（主文档解析完成，outerHTML 已含全部内容，解析 HTML 只需标记结构）。
3. **`eval` 在未提交的文档上会延迟执行**：早期「给旧文档打 stale 标记再导航」的做法里，标记
   迟到落到了新文档上，永远清不掉。复位 + href 判定替代此方案。
4. **爬虫侧的两类验证页**：Cloudflare 挑战（多语言标题 + `#challenge-form`/turnstile 容器）与
   包子漫画 tw 域自建 PoW（`__gatekeeper_challenge` 资源 + 「正在验证浏览器」标题）。验证通过后的
   票据 cookie（cf_clearance / gatekeeper）由 WKWebView 持久化数据存储保留，重启应用仍有效。
5. **baozimh 的实际链路**：搜索/详情/分类在 `cn.baozimh.com` 直接可得；章节阅读页要经
   `/user/page_direct?comic_id={站内id}&section_slot=&chapter_slot=` 中转（站内 id 带随机后缀，
   公开 slug 推不出来）→ 302 到镜像域（twmanga/twbzmg 等轮换）→ 自建验证 → 阅读页。

## baozimh 源接入（首个消费源）

- 页面是 AMP 服务端渲染：卡片 = `comics-card__poster` 锚（封面 amp-img）+ `comics-card__info`
  锚（标题 h3 / 作者 small.tags）；详情 = `h1.comics-detail__title` + `h2.comics-detail__author` +
  tag-list（首个 span 为状态）+ `p.comics-detail__desc` + 「最新：<a>」；章节锚
  `comics-chapters__item`（可见区最新 24 话与 `chapters_other_list` 全量重复，去重后按槽位升序，
  index = 1 起序号）；阅读页图片 = `amp-img id="chapter-img-{s}-{n}"` 的 src。
- 章节中转链 URL 由 detail 解析输出隐藏字段 `pageUrl`，Rust `post_process` 提取入进程内缓存
  （`crawler/baozimh.rs`）并剥离字段；images 的 `build_ctx` 从缓存取（同 webtoons seriesUrl /
  dongman viewerUrl 形状）。缓存驻留进程内，重启后首次进详情页重建。
- 图片 CDN（`s1.bzcdn.net` / `s1.baozimh.com`）无热链保护，前端不需加 Referer 表项。

## 验证（真网，本机数据中心 IP）

```bash
cd desktop/src-tauri
cargo run --example render_probe -- crawl baozimh search '{"keyword":"海贼"}'   # 77 条结果
cargo run --example render_probe -- crawl baozimh category '{"label":"热血"}'   # 37 条结果
cargo run --example render_probe -- chain baozimh baozimh-haizeiwang-weitianrongyilang 1187
# detail: 1187 章、pageUrl 不泄漏；images: 18 张（末章）／50 张（第 1 章）
```

离线侧：fixture 双轨（`tests/source_script_test.rs` + `baozimh.test.js`），fixture 从真网转储裁剪
（只去 AMP sizer/svg 展示噪音），另有 `crawl("search","baozimh",…)` 在无渲染通道宿主下报
「渲染通道未注册」并返回空结果的接线测试。

## 维护注意

- 镜像域轮换（cn.baozimh.com → twmanga.com / cn.twbzmg.com 等）由 `page_direct` 中转自动跟随，
  脚本里不硬编码镜像域；只有 `cn.baozimh.com` 是稳定入口。
- 站点改版时优先跑探针 dump 重新核对结构（搜索卡片 / 详情信息区 / 章节锚 / 阅读页 amp-img）。
- 验证页形态变化（新挑战标记）时更新 `src-tauri/src/render.rs` 的 `STATE_EXPR`；
  `CIMOC_RENDER_TRACE=1` 可看到每轮状态。
- 渲染通道是单飞（一次一个页面）：crawl 并发调用在 `render::FLIGHT` 互斥排队，整体超时 60 秒。
