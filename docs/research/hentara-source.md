# Hentara hentara.com 源 — 实现状态与验证指南（2026-09-30）

## 状态

Hentara（英文成人韩漫站）已作为内置源接入源脚本系统，**全链路已在本环境真网验证通过**：
搜索「harem」12 条 / 分类「全部」24 条 / 详情 14 话 / 首话 14 张图。站点与数据 CDN 都无 IP
风控，普通 HTTP 客户端即可抓取。

该站前端是 Vite SPA + 构建期 Puppeteer 预渲染，另有**站点自带的静态 JSON 数据接口**
（`cdn.hentara.com/data`）——脚本直接用它，与站内浏览同源数据，省掉 HTML 解析：

| 用途 | 接口 |
|---|---|
| 全站目录（搜索在脚本内过滤） | `data/index.json`（1588 部：title/slug/thumbnail_url/episode_count/latest_episode/updated_at） |
| 详情 | `data/comics/{slug}.json`（comic + episodes + total_episodes） |
| 章节图片 | `data/episodes/{slug}/{话数}.json`（pages[].image_url） |

分类走预渲染 HTML 的列表页（每页 24 部卡片）；阅读器图片（`cdn.hentara.com`）无热链校验，
直接加载，无需 img 代理。

实现文件：
- `desktop/crates/cimoc-core/src/js/sources/hentara.js` — 源脚本（buildUrl/parse，五 op）
- `desktop/crates/cimoc-core/src/crawler/hentara.rs` — 请求头（薄文件）
- `desktop/crates/cimoc-core/src/crawler/script.rs` — search 的 ctx（keyword，脚本内过滤用）
- `desktop/crates/cimoc-core/src/crawler/mod.rs`、`js/sources.rs` — 分派/内置
- `desktop/src/screens/Sources.tsx`、`src/lib/storage.ts` — 书源 tab、SOURCE_NAMES
- fixture：`tests/fixtures/hentara-{index.json,browse.html,genre.html,detail.json,episode.json}`
  （目录 fixture 是从真网 110KB 的 index.json 裁剪出的 3 部样本）

测试：cargo test 44 项、source_script_test 新增 5 项、vitest 128 项、tsc 0，全绿。
真网：

```bash
cd desktop
cargo test -p cimoc-core --test live_smoke -- --ignored hentara
# hentara detail: N 章；首章 M 张图
```

## 维护注意

- **搜索是本地过滤**：站点的服务端渲染对 `/browse?search=` 不做过滤（返回未过滤的整页），
  站内搜索实际由前端在 `index.json` 上做。脚本照做：`search` op 抓 `index.json`，在 QuickJS 里
  按标题子串过滤（大小写不敏感），按 `updated_at` 倒序排前，命中上限 60 条（避免宽泛关键词把
  上千部灌进列表页）。
- **分类是预渲染 HTML**：`/browse`、`/popular-manhwa`、`/latest-manhwa`、`/uncensored-manhwa`、
  `/hottest-manhwa`、`/hentai-read`，以及题材页 `/genres/{slug}-manhwa`（12 个，脚本 `GENRES`）。
  列表分页与筛选是前端行为，服务端对 `?page=` 不生效——所以每个分类给的是首页 24 部。
- **卡片有三种形态**（`ssr-card` / `pg-card` / `genre-card`），但锚统一是 `href="/manhwa/{slug}"`，
  标题容器类名是 `{形态}-card-title`；脚本按这三种类名依次取，取不到再退回 `img alt`。
  章节链接是 `/manhwa/{slug}/chapter-N`，带斜杠，脚本按此把章节锚排除在漫画卡片之外。
- **话数 = 章节 JSON 的文件名**（`episodes/{slug}/{episode_number}.json`），episode_number 同时
  作为 `Chapter.index` 与 images 的 chapterIndex，可重建。
- **列表页封面有两种 CDN 前缀**：`cdn.hentara.com/{slug}/thumbnail.*`（browse/home）与
  `cdn.hentara.com/data/{slug}/thumbnail`（题材页，无扩展名）。脚本按页面给出的 URL 原样返回。
- **详情 JSON 的 `genres` 大多为空数组**（1588 部里只有 6 部带题材标签），题材筛选因此走
  题材列表页而不是目录过滤。

## 结构要点（2026-09-30 实测）

- 列表卡片：`<a href="/manhwa/{slug}" class="pg-card"><img src="…"><div class="pg-card-title">{标题}</div>
  <div class="pg-card-meta">{N} chapters</div></a>`（`ssr-card` 用 `<span>`、`genre-card` 用
  `<div class="genre-card-title">`，其余同构）。
- 详情 JSON：`{"comic": {slug,title,description,thumbnail_url,cover_url,…},
  "episodes": [{episode_number,title,thumbnail_url,…}], "total_episodes": N}`；
  话标题常为空串，脚本用 `Chapter {N}` 兜底。
- 章节 JSON：`{"episode": {…}, "comic": {…}, "pages": [{page_number, image_url}],
  "navigation": {prev_episode, next_episode, total_episodes}}`。
