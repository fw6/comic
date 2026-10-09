// Hentara hentara.com 源脚本（2026-09-30 新增）
//
// 契约（见 mojuan-core/src/js/mod.rs）：
//   buildUrl(op, payload, ctx) -> string  —— 构造 op 请求 URL（空串 = 不抓取）
//   parse(op, input, ctx) -> JSON 字符串   —— 解析 HTML/JSON 为 crawl 协议 JSON
// 运行环境：QuickJS（rquickjs 0.12.2），白名单 Date/Json/Eval —— 只用字符串方法，
// 不用正则/Map（research #14 修订基线，RegExp 后置）。
//
// 站方前端（Vite SPA）自带一套静态 JSON 数据接口，本脚本直接用它（与站内浏览同源数据）：
//   {data}/index.json                     全站目录（1588 部；搜索在脚本内过滤）
//   {data}/comics/{slug}.json             详情：comic + episodes
//   {data}/episodes/{slug}/{话数}.json     章节：pages[].image_url
// 分类走站点预渲染（Puppeteer SSR）的列表页 HTML，卡片锚统一是 /manhwa/{slug}。
// 图片 CDN（cdn.hentara.com）无热链校验（带不带 Referer 都 200），阅读器直接加载。
//
// 结构已在本环境实测验证（2026-09-30）：/browse 等列表页 24 卡；index.json 1588 部；
// 详情 4 话、末话 14 页。

var SITE = "https://hentara.com";
var DATA = "https://cdn.hentara.com/data";
var PREFIX = "hentara-";

// 分类（站点预渲染列表页路径，2026-09-30 实测；每页 24 部）
var CATS = {
  "全部": "/browse",
  "热门": "/popular-manhwa",
  "最新": "/latest-manhwa",
  "无修正": "/uncensored-manhwa",
  "最热": "/hottest-manhwa",
  "Hentai": "/hentai-read"
};

// 题材（/genres/{slug}-manhwa，2026-09-30 实测）
var GENRES = {
  "Adult": "adult",
  "Romance": "romance",
  "Action": "action",
  "Drama": "drama",
  "Fantasy": "fantasy",
  "Harem": "harem",
  "Mature": "mature",
  "School Life": "school-life",
  "Comedy": "comedy",
  "Slice of Life": "slice-of-life",
  "Isekai": "isekai",
  "Doujinshi": "doujinshi"
};

// 搜索命中上限：index.json 覆盖全站 1588 部，宽泛关键词匹配过多会让列表页失去意义
var SEARCH_LIMIT = 60;

// ---------- 入口 ----------

function buildUrl(op, payload, ctx) {
  var p = JSON.parse(payload || "{}");
  switch (op) {
    case "categories":
      return ""; // 静态分类列表，不经抓取
    case "search":
      // 站内搜索是前端在 index.json 上过滤（/browse?search= 服务端返回未过滤列表）
      return DATA + "/index.json";
    case "category":
      var path = CATS[p.label];
      if (!path && GENRES[p.label]) path = "/genres/" + GENRES[p.label] + "-manhwa";
      return path ? SITE + path : "";
    case "detail":
      return DATA + "/comics/" + slug(p.comicId || "") + ".json";
    case "images":
      // 话数即章节 URL 的编号（详情 episodes[].episode_number）
      return DATA + "/episodes/" + slug(p.comicId || "") + "/" + (p.chapterIndex || 0) + ".json";
    default:
      throw new Error("未知 op: " + op);
  }
}

function parse(op, input, ctx) {
  var c = JSON.parse(ctx || "{}");
  switch (op) {
    case "categories":
      return JSON.stringify(catLabels());
    case "search":
      return JSON.stringify(searchComics(input, c.keyword || ""));
    case "category":
      return JSON.stringify(parseCards(input));
    case "detail":
      return JSON.stringify(parseDetail(input));
    case "images":
      return JSON.stringify(parseImages(input));
    default:
      throw new Error("未知 op: " + op);
  }
}

function catLabels() {
  var out = [];
  for (var k in CATS) out.push(k);
  for (var g in GENRES) out.push(g);
  return out;
}

// "hentara-capitalist-harem" -> "capitalist-harem"
function slug(comicId) {
  return comicId.indexOf(PREFIX) === 0 ? comicId.slice(PREFIX.length) : comicId;
}

// ---------- HTML 小工具（字符串方法，无正则；复用 webtoons.js 约定） ----------

function collapse(s) {
  var out = "";
  var ws = false;
  for (var i = 0; i < s.length; i++) {
    var ch = s[i];
    if (ch === " " || ch === "\n" || ch === "\t" || ch === "\r") {
      ws = out.length > 0;
    } else {
      if (ws) out += " ";
      out += ch;
      ws = false;
    }
  }
  return out;
}

function attr(tag, name) {
  var key = name + '="';
  var a = tag.indexOf(key);
  if (a < 0) return "";
  var b = tag.indexOf('"', a + key.length);
  return b < 0 ? "" : tag.slice(a + key.length, b);
}

function stripTags(s) {
  var out = "";
  var inTag = false;
  for (var i = 0; i < s.length; i++) {
    var ch = s[i];
    if (ch === "<") inTag = true;
    else if (ch === ">") {
      inTag = false;
      out += " ";
    } else if (!inTag) {
      out += ch;
    }
  }
  return out;
}

// 含 marker 的元素的 {open, inner, end}：marker 如 'class="pg-card-title"'
function elementWith(body, marker, from) {
  var a = body.indexOf(marker, from || 0);
  if (a < 0) return null;
  var s = body.lastIndexOf("<", a);
  if (s < 0) return null;
  var gt = body.indexOf(">", s);
  if (gt < 0) return null;
  var open = body.slice(s, gt + 1);
  var name = open.slice(1).split(" ")[0].split(">")[0].split("/")[0];
  var close = body.indexOf("</" + name + ">", gt);
  return {
    open: open,
    inner: close < 0 ? "" : body.slice(gt + 1, close),
    end: close < 0 ? gt + 1 : close + name.length + 3,
  };
}

// 以 marker 切段：每段从 marker 起到下一个 marker 前
function splitOn(html, marker) {
  var out = [];
  var i = 0;
  for (;;) {
    var s = html.indexOf(marker, i);
    if (s < 0) break;
    var e = html.indexOf(marker, s + marker.length);
    out.push(html.slice(s, e < 0 ? html.length : e));
    if (e < 0) break;
    i = e;
  }
  return out;
}

// "/manhwa/capitalist-harem" -> "capitalist-harem"（章节锚 /manhwa/{slug}/chapter-N 返回空）
function slugFromHref(href) {
  var key = "/manhwa/";
  if (href.indexOf(key) !== 0) return "";
  var rest = href.slice(key.length);
  if (!rest || rest.indexOf("/") >= 0) return "";
  return rest;
}

// ---------- 列表页：漫画卡片 ----------
//
// 预渲染列表页的卡片锚统一是 <a href="/manhwa/{slug}" class="pg-card|ssr-card|genre-card">
//   <img src="https://cdn.hentara.com/{slug}/thumbnail.*" alt="{标题}">
//   <div|span class="{…}-card-title">{标题}</div|span>
//   <div|span class="{…}-card-meta">{N} chapters</div|span>
// </a>

function parseCards(html) {
  var out = [];
  var seen = {};
  var anchors = splitOn(html, "<a ");
  for (var i = 0; i < anchors.length; i++) {
    var gt = anchors[i].indexOf(">");
    if (gt < 0) continue;
    var tag = anchors[i].slice(0, gt + 1);
    var id = slugFromHref(attr(tag, "href"));
    if (!id || seen[id]) continue;
    seen[id] = true;
    out.push(cardComic(id, anchors[i]));
  }
  return out;
}

function cardComic(slugValue, anchor) {
  var img = elementWith(anchor, "<img");
  var title = cardTitle(anchor);
  if (!title && img) title = attr(img.open, "alt");
  return {
    id: PREFIX + slugValue,
    source: "hentara",
    sourceTitle: "Hentara",
    title: title || slugValue,
    author: "",
    intro: "",
    cover: img ? attr(img.open, "src") : "",
    status: "serial",
    updateTime: "",
    lastChapter: "",
    tags: [],
    lastReadChapter: 0,
    lastReadTime: 0,
  };
}

// 三种卡片形态的标题容器类名（同一页面只用其中一种）
function cardTitle(anchor) {
  var classes = ["ssr-card-title", "pg-card-title", "genre-card-title"];
  for (var i = 0; i < classes.length; i++) {
    var el = elementWith(anchor, 'class="' + classes[i] + '"');
    if (el) {
      var t = collapse(stripTags(el.inner));
      if (t) return t;
    }
  }
  return "";
}

// ---------- 搜索：index.json 本地过滤 ----------
//
// index.json：{comics: [{slug, title, thumbnail_url, episode_count, latest_episode_date, updated_at, …}]}

function searchComics(input, keyword) {
  var data;
  try {
    data = JSON.parse(input);
  } catch (e) {
    throw new Error("index.json 解析失败: " + e.message);
  }
  var comics = (data && data.comics) || [];
  var kw = collapse(keyword).toLowerCase();
  var hits = [];
  for (var i = 0; i < comics.length; i++) {
    var c = comics[i];
    var title = c.title || "";
    if (title.toLowerCase().indexOf(kw) >= 0) hits.push(c);
  }
  // 最近更新的排前面（命中过多时优先给新作）
  hits.sort(function (a, b) {
    return String(b.updated_at || "").localeCompare(String(a.updated_at || ""));
  });
  var out = [];
  for (var j = 0; j < hits.length && j < SEARCH_LIMIT; j++) {
    var h = hits[j];
    out.push({
      id: PREFIX + h.slug,
      source: "hentara",
      sourceTitle: "Hentara",
      title: h.title || h.slug,
      author: "",
      intro: h.description || "",
      cover: h.thumbnail_url || "",
      status: "serial",
      updateTime: "",
      lastChapter: h.latest_episode ? "Chapter " + h.latest_episode : "",
      tags: [],
      lastReadChapter: 0,
      lastReadTime: 0,
    });
  }
  return out;
}

// ---------- 详情：comics/{slug}.json ----------

function parseDetail(input) {
  var data = JSON.parse(input);
  var c = data.comic || {};
  var episodes = data.episodes || [];
  var chapters = [];
  var seen = {};
  for (var i = 0; i < episodes.length; i++) {
    var ep = episodes[i];
    var n = Number(ep.episode_number);
    if (!(n >= 0) || seen[n]) continue; // 同话多条（不同版本）保留先出现的
    seen[n] = true;
    chapters.push({
      index: n,
      title: collapse(ep.title || "") || "Chapter " + n,
      pages: [],
      external: false,
      downloaded: false,
      read: false,
    });
  }
  chapters.sort(function (a, b) {
    return a.index - b.index;
  });
  return {
    comic: {
      id: PREFIX + (c.slug || ""),
      source: "hentara",
      sourceTitle: "Hentara",
      title: c.title || c.slug || "",
      author: "",
      intro: c.description || "",
      cover: c.cover_url || c.thumbnail_url || "",
      status: "serial",
      updateTime: "",
      lastChapter: chapters.length ? chapters[chapters.length - 1].title : "",
      tags: genreNames(c.genres),
      lastReadChapter: 0,
      lastReadTime: 0,
    },
    chapters: chapters,
  };
}

function genreNames(genres) {
  var out = [];
  if (!genres || !genres.length) return out;
  for (var i = 0; i < genres.length; i++) {
    var g = genres[i];
    var name = typeof g === "string" ? g : g && g.name ? g.name : "";
    if (name) out.push(name);
  }
  return out;
}

// ---------- 章节：episodes/{slug}/{话数}.json ----------

function parseImages(input) {
  var data = JSON.parse(input);
  var pages = data.pages || [];
  var out = [];
  var seen = {};
  for (var i = 0; i < pages.length; i++) {
    var u = pages[i] && pages[i].image_url;
    if (u && !seen[u]) {
      seen[u] = true;
      out.push(u);
    }
  }
  return out;
}

// vitest 侧加载入口（Rust 引擎读全局 buildUrl/parse，二者都在）
globalThis.__source = { buildUrl: buildUrl, parse: parse };
