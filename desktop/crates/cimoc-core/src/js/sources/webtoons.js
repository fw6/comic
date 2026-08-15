// Webtoons 源脚本 —— 源运行时系统首批源（wayfinder #11/#15/#16 定案，2026-08-15）
//
// 契约（见 cimoc-core/src/js/mod.rs）：
//   buildUrl(op, payload, ctx) -> string  —— 构造 op 请求 URL（空串 = 不抓取）
//   parse(op, input, ctx) -> JSON 字符串   —— 解析 HTML 为 crawl 协议 JSON
// 运行环境：QuickJS（rquickjs 0.12.2），白名单 Date/Json/Eval —— 只用字符串方法，
// 不用正则/Map（research #14 修订基线，RegExp 后置）。
//
// 约定：search/category 输出每项带隐藏字段 seriesUrl（列表页 href），Rust 侧
// （crawler/script.rs）提取填入系列 URL 缓存并剥掉该字段——前端契约不变。

var BASE = "https://www.webtoons.com/en";
var GENRES = [
  ["action", "动作"],
  ["romance", "恋爱"],
  ["comedy", "搞笑"],
  ["drama", "剧情"],
  ["fantasy", "奇幻"],
  ["horror", "恐怖"],
  ["sci-fi", "科幻"],
  ["sports", "体育"],
];

// ---------- 入口 ----------

function buildUrl(op, payload, ctx) {
  var p = JSON.parse(payload || "{}");
  var c = JSON.parse(ctx || "{}");
  switch (op) {
    case "categories":
      return "";
    case "search":
      return BASE + "/search?keyword=" + encodeURIComponent(p.keyword || "");
    case "category":
      return BASE + "/genres/" + genreKey(p.label || "");
    case "detail": {
      var su = c.seriesUrl || "";
      return su || BASE + "/any/list?title_no=" + titleNo(p.comicId || "");
    }
    case "images": {
      var ep = p.chapterIndex || 0;
      var tn = titleNo(p.comicId || "");
      var slug = slugFrom(c.seriesUrl || "");
      if (slug) {
        return BASE + "/" + slug + "/episode-" + ep + "/viewer?title_no=" + tn + "&episode_no=" + ep;
      }
      return BASE + "/any/episode-" + ep + "/viewer?title_no=" + tn + "&episode_no=" + ep;
    }
    default:
      throw new Error("未知 op: " + op);
  }
}

function parse(op, input, ctx) {
  switch (op) {
    case "categories":
      return JSON.stringify(GENRES.map(function (g) { return g[1]; }));
    case "search":
    case "category":
      return JSON.stringify(parseList(input));
    case "detail":
      return JSON.stringify(parseDetail(input, JSON.parse(ctx || "{}")));
    case "images":
      return JSON.stringify(parseViewer(input));
    default:
      throw new Error("未知 op: " + op);
  }
}

// ---------- URL 小工具 ----------

function genreKey(label) {
  for (var i = 0; i < GENRES.length; i++) {
    if (GENRES[i][1] === label) return GENRES[i][0];
  }
  return GENRES[0][0];
}

function titleNo(comicId) {
  return comicId.indexOf("webtoons-") === 0 ? comicId.slice("webtoons-".length) : comicId;
}

function slugFrom(seriesUrl) {
  var prefix = "https://www.webtoons.com/en/";
  if (seriesUrl.indexOf(prefix) !== 0) return "";
  var rest = seriesUrl.slice(prefix.length);
  var q = rest.indexOf("/list?");
  if (q < 0) return "";
  var slug = rest.slice(0, q);
  return slug && slug.indexOf("/") >= 0 ? slug : "";
}

// ---------- HTML 小工具（字符串方法，无正则） ----------

// 折叠空白（含换行/制表符）
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

// 从标签字符串里取属性值
function attr(tag, name) {
  var key = name + '="';
  var a = tag.indexOf(key);
  if (a < 0) return "";
  var b = tag.indexOf('"', a + key.length);
  return b < 0 ? "" : tag.slice(a + key.length, b);
}

// key 后紧跟的连续数字（如 "title_no=1571" -> "1571"）
function digitsAfter(s, key) {
  var a = s.indexOf(key);
  if (a < 0) return "";
  var b = a + key.length;
  var out = "";
  while (b < s.length && s[b] >= "0" && s[b] <= "9") {
    out += s[b];
    b++;
  }
  return out;
}

// 找所有 <tagName ...>...</tagName> 平铺块（不嵌套解析；自闭合标签 body 为空）
function blocks(html, tagName) {
  var open = "<" + tagName;
  var close = "</" + tagName + ">";
  var out = [];
  var i = 0;
  for (;;) {
    var s = html.indexOf(open, i);
    if (s < 0) break;
    var e = html.indexOf(">", s);
    if (e < 0) break;
    var c = html.indexOf(close, e);
    out.push({
      tag: html.slice(s, e + 1),
      body: c < 0 ? "" : html.slice(e + 1, c),
    });
    i = c < 0 ? e + 1 : c + close.length;
  }
  return out;
}

// 块内第一个 <tag class="cls">…</tag> 的文本（cls 为空则匹配 <tag>）
function textOf(body, tag, cls) {
  var open = cls ? "<" + tag + ' class="' + cls + '">' : "<" + tag + ">";
  var a = body.indexOf(open);
  if (a < 0) return "";
  var b = a + open.length;
  var c = body.indexOf("</" + tag + ">", b);
  return c < 0 ? "" : collapse(body.slice(b, c));
}

// 块内第一个 img 的 alt
function imgAlt(body) {
  var t = firstImgTag(body);
  return t ? collapse(attr(t, "alt")) : "";
}

// 块内第一个 img 的封面图（data-src 优先，其次 src；须是图片扩展名）
function imgCover(body) {
  var t = firstImgTag(body);
  if (!t) return "";
  var u = attr(t, "data-src") || attr(t, "src");
  return isImageUrl(u) ? u : "";
}

function firstImgTag(body) {
  var s = body.indexOf("<img");
  if (s < 0) return "";
  var e = body.indexOf(">", s);
  return e < 0 ? "" : body.slice(s, e + 1);
}

function isImageUrl(u) {
  var l = u.toLowerCase();
  return (
    l.indexOf(".jpg") >= 0 || l.indexOf(".jpeg") >= 0 ||
    l.indexOf(".png") >= 0 || l.indexOf(".webp") >= 0
  );
}

// ---------- 列表页：系列卡片 ----------

// 输入 <a href="…/list?title_no=NNN">…<strong class="title">…</strong>…</a> 块
function parseList(html) {
  var out = [];
  var seen = {};
  var items = blocks(html, "a");
  for (var i = 0; i < items.length; i++) {
    var b = items[i];
    var href = attr(b.tag, "href");
    if (href.indexOf("/list?title_no=") < 0) continue;
    if (href.indexOf(BASE) !== 0) continue;
    var id = digitsAfter(href, "title_no=");
    if (!id || seen[id]) continue;
    seen[id] = true;
    var title =
      textOf(b.body, "strong", "title") ||
      textOf(b.body, "p", "subj") ||
      imgAlt(b.body) ||
      attr(b.tag, "title") ||
      "Webtoon " + id;
    out.push({
      id: "webtoons-" + id,
      source: "webtoons",
      sourceTitle: "Webtoons",
      title: title,
      author: "",
      intro: "",
      cover: imgCover(b.body),
      status: "serial",
      updateTime: "",
      lastChapter: "",
      tags: [],
      lastReadChapter: 0,
      lastReadTime: 0,
      seriesUrl: href, // 隐藏字段：Rust 提取入缓存后剥离（前端契约不变）
    });
    if (out.length >= 24) break;
  }
  return out;
}

// ---------- 详情页 ----------

function parseDetail(html, ctx) {
  var title =
    textOf(html, "h1", "subj") ||
    textOf(html, "h1", "") ||
    textOf(html, "title", "") ||
    "Webtoon " + (ctx.titleNo || "");
  var cover = metaContent(html, "og:image") || imgThumb(html) || imgPhinf(html);
  var author = textOf(html, "div", "author").split("/")[0].trim();
  var intro = textOf(html, "p", "summary");
  var chapters = parseChapters(html);
  return {
    comic: {
      id: "webtoons-" + (ctx.titleNo || ""),
      source: "webtoons",
      sourceTitle: "Webtoons",
      title: title,
      author: author,
      intro: intro,
      cover: cover,
      status: "serial",
      updateTime: "",
      lastChapter: chapters.length ? chapters[0].title : "",
      tags: ["Webtoons"],
      lastReadChapter: 0,
      lastReadTime: 0,
    },
    chapters: chapters,
  };
}

function metaContent(html, property) {
  var items = blocks(html, "meta");
  for (var i = 0; i < items.length; i++) {
    if (attr(items[i].tag, "property") === property) return attr(items[i].tag, "content");
  }
  return "";
}

function imgThumb(html) {
  var items = blocks(html, "img");
  for (var i = 0; i < items.length; i++) {
    if (items[i].tag.indexOf("thumb") >= 0) return attr(items[i].tag, "src");
  }
  return "";
}

function imgPhinf(html) {
  var items = blocks(html, "img");
  for (var i = 0; i < items.length; i++) {
    var u = attr(items[i].tag, "src");
    if (u.indexOf("webtoon-phinf.pstatic.net") >= 0) return u;
  }
  return "";
}

// <a href="…/viewer?…&episode_no=N"> 块 → 章节（按 index 降序，与 Rust 一致）
function parseChapters(html) {
  var out = [];
  var seen = {};
  var items = blocks(html, "a");
  for (var i = 0; i < items.length; i++) {
    var b = items[i];
    var href = attr(b.tag, "href");
    if (href.indexOf("/viewer?") < 0) continue;
    var ep = digitsAfter(href, "episode_no=");
    if (!ep || seen[ep]) continue;
    seen[ep] = true;
    var index = Number(ep);
    out.push({
      index: index,
      title: imgAlt(b.body) || subjText(b.body) || "第 " + ep + " 话",
      pages: [],
      external: false,
      downloaded: false,
      read: false,
    });
  }
  out.sort(function (a, b) { return b.index - a.index; });
  return out;
}

// <span class="subj"><span>标题</span><em>…</em></span> 的内层 span 文本
function subjText(body) {
  var open = '<span class="subj">';
  var s = body.indexOf(open);
  if (s < 0) return "";
  var innerStart = s + open.length;
  var firstSpan = body.indexOf("<span", innerStart);
  if (firstSpan >= 0) {
    var ts = body.indexOf(">", firstSpan);
    var te = body.indexOf("</span>", ts);
    if (te >= 0) return collapse(body.slice(ts + 1, te));
    return "";
  }
  var end = body.indexOf("</span>", innerStart);
  return end < 0 ? "" : collapse(stripTags(body.slice(innerStart, end)));
}

// 去标签（字符扫描，同 Rust strip_html）
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

// ---------- 阅读页：图片 ----------

function parseViewer(html) {
  var out = [];
  var imgs = blocks(html, "img");
  for (var i = 0; i < imgs.length; i++) {
    var tag = imgs[i].tag;
    if (tag.indexOf("_images") < 0) continue;
    var u = attr(tag, "data-url");
    if (u) out.push(u);
  }
  return out;
}

// vitest 侧加载入口（Rust 引擎读全局 buildUrl/parse，二者都在）
globalThis.__source = { buildUrl: buildUrl, parse: parse };
