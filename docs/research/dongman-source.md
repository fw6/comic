# 咚漫 dongmanmanhua.cn 源 — 实现状态与验证指南（2026-08-19）

## 状态

咚漫（中文 Webtoon 官方站）已作为内置源接入源脚本系统。**全链路（搜索 → 详情 → 章节 → viewer → 图片）已在本环境真网验证通过**——咚漫不做 IP 风控，数据中心 IP 可正常访问。

实现文件：
- `desktop/crates/mojuan-core/src/js/sources/dongman.js` — 源脚本（buildUrl/parse，五 op）
- `desktop/crates/mojuan-core/src/crawler/sources/dongman.rs` — 源适配器（请求头、章节 viewer URL 缓存与 images 的 ctx、图片热链对）
- `desktop/src/screens/Sources.tsx` — 书源 tab（源清单来自源注册表，无需按源改动）
- fixture：`tests/fixtures/dongman-{search,detail,viewer}.html`

测试：cargo test 44 项（lib，含 dongman.rs 4 个单测 + mock）、source_script_test 23 项、vitest 97 项、tsc 0，全绿。

## 真网验证

```bash
cd desktop
cargo test -p mojuan-core --test live_smoke -- --ignored dongman
```

**预期**：`dongman_live_search` 与 `dongman_live_detail_and_images` 都通过，打印
`dongman: N 条，首条 dongman-xxxx / 标题` 与 `dongman detail: N 章；首章 M 张图`。
本环境 2026-08-19 实测已通过。

**若失败**：多为外网站点结构变动，按 panic 消息排查；咚咚漫无 IP 风控，家用网络应与本机一致。

## 维护注意

- **URL 形态**：搜索 `/search?keyword=`；分类 `/{GENRE}`（10 个 genre 码见脚本 `GENRES`）；
  详情用 `/episodeList?titleNo=N`（301 到 `/{GENRE}/{group}/list?title_no=N`，http 客户端自动跟随）。
- **章节 viewer URL 不可重建**（含中文 slug）：Rust 侧从详情页提取 episode_no → viewer URL 并缓存，
  images 的 ctx.viewerUrl 由 `dongman.rs::viewer_url_for` 提供（cache miss 拉一次详情页）。
- **图片**：`cdn.dongmanmanhua.cn`，无需登录；前端 imgSrc 已重写经本机代理带 Referer（站点根）拉取。
- **免费章节**：部分章节付费（咚币），详情页「免费」章节可读；付费章节可能打不开（服务端行为，非代码问题）。

## 结构要点（2026-08-19 实测）

- 搜索/分类卡片：`<ul class="card_lst"><li id="title_li_{N}" data-title-no="{N}">` → `a.card_item` →
  `.subj`（标题）/`.author`（作者）/img cover。**注意首页分类榜单的 `<li>` 无 `data-title-no`**，脚本据此过滤。
- 详情章节：`<ul id="_listUl"><li id="episode_{M}" data-episode-no="{M}">` → `a[href*=/viewer?]`、
  `.subj span`（标题）/`.date`。
- 阅读页图片：`<img class="_images _centerImg" data-url="https://cdn.dongmanmanhua.cn/…">`（排除 `_thumbnailImages`）。
