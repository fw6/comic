# 开心看漫画 kxmanhua.com 源 — 实现状态与验证指南（2026-09-30）

## 状态

开心看漫画（中文成人漫画站，韩漫/日漫/3D）已作为内置源接入源脚本系统，**全链路已在本环境
真网验证通过**：搜索命中 / 分类「韩漫」24 条 / 详情 5 话 / 首话 262 张图。站点无 IP 风控，
普通 HTTP 客户端即可抓取（服务端渲染的 PHP 站，不依赖 JS）。

实现文件：
- `desktop/crates/mojuan-core/src/js/sources/kxmanhua.js` — 源脚本（buildUrl/parse，五 op）
- `desktop/crates/mojuan-core/src/crawler/kxmanhua.rs` — 请求头（薄文件）
- `desktop/crates/mojuan-core/src/crawler/script.rs` — detail 的 ctx（comicId，用于过滤本作章节）
- `desktop/crates/mojuan-core/src/crawler/mod.rs`、`js/sources.rs` — 分派/内置
- `desktop/src/screens/Sources.tsx`、`src/lib/storage.ts` — 书源 tab、SOURCE_NAMES
- fixture：`tests/fixtures/kxmanhua-{search,detail,chapter}.html`（真网转储裁剪）

测试：cargo test 44 项、source_script_test 新增 5 项、vitest 128 项、tsc 0，全绿。
真网：

```bash
cd desktop
cargo test -p mojuan-core --test live_smoke -- --ignored kxmanhua
# kxmanhua detail: N 章；首章 M 张图
```

## 维护注意

- **URL 形态**：搜索 `/manga/search?keyword=`；分类 `/manga/library?{type|orderby|complete}=N`；
  详情 `/manga/{漫画号}`；章节页 `/manga/{漫画号}/detail/{章节号}`。
- **章节号 = 章节页 URL 的末段数字**（详情页章节锚里给出），同时作为 `Chapter.index` 与 images 的
  chapterIndex，可重建，Rust 侧不需要缓存。详情页章节表是倒序（最新在前），脚本解析后按章节号升序。
- **状态字段只在封面区判读**：卡片是 `ep`（连载）/`epgreen`（完结），详情页封面区同理；
  详情页侧栏「同类推荐」里也有 `epgreen`，脚本把判读范围限定在封面区片段内。
- **章节标题取锚文本**（「第N话」），`title` 属性带「韩漫 {书名} 」前缀，是备选。
- **图片**：`img.imh99.top/webtoon/content/…`，广告位在同域 `/webtoon/ad-slider/`，脚本按
  `/webtoon/content/` 过滤；CDN 无热链校验（带不带 Referer 都 200），阅读器直接加载，无需 img 代理。
- **分类参数**：`type` 1=3D漫画 2=韩漫 3=日漫 4=真人漫画 5=耽美BL；`complete` 2=完结 3=连载；
  `orderby` 1=最热门 2=最近更新 3=最新上架（脚本 `CATS`）。
- 站点页脚有大量外链广告位（genrati / emberloft / kxkmh 等），与解析无关，忽略即可。

## 结构要点（2026-09-30 实测）

- 列表卡片（搜索页与分类页同构）：

  ```html
  <div class="product__item">
    <div class="product__item__pic set-bg" data-setbg="{封面}"
         onclick="location.href='/manga/{漫画号}';">
      <div class="ep">连载</div>          <!-- 完结则是 class="epgreen" -->
    </div>
    <div class="product__item__text"><h6><a href="/manga/{漫画号}">{标题}</a></h6></div>
  </div>
  ```

  搜索页的卡片锚没有 `title` 属性，分类页有；脚本优先取锚文本、`title` 属性兜底。

- 详情：`<div class="anime__details__pic set-bg" data-setbg="{封面}">`；
  `<div class="anime__details__title"><h3>{标题}</h3><span>作者：{作者}</span><span>别名：…</span></div>`；
  简介在评分块之后、`anime__details__widget` 之前的 `<p>`；
  章节在 `<div class="chapter_list">` 内的 `<a href="/manga/{漫画号}/detail/{章节号}" title="…">第N话</a>`。
- 章节页：`<img src="https://img.imh99.top/webtoon/content/{漫画}/{章节}/{序号}_{时间戳}.webp"
  loading="lazy" alt="开心看漫画图片列表">`。
