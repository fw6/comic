// 咚漫 中文 Webtoon 源脚本（2026-08-19 新增）
//
// 契约（见 cimoc-core/src/js/mod.rs）：
//   buildUrl(op, payload, ctx) -> string  —— 构造 op 请求 URL（空串 = 不抓取）
//   parse(op, input, ctx) -> JSON 字符串   —— 解析 HTML 为 crawl 协议 JSON
// 运行环境：QuickJS（rquickjs 0.12.2），白名单 Date/Json/Eval —— 只用字符串方法，
// 不用正则/Map（research #14 修订基线，RegExp 后置）。
//
// 结构已在本环境实测验证（2026-08-19）：搜索/分类卡片 <ul class="card_lst"><li
// data-title-no>；详情章节 <ul id="_listUl"><li id="episode_N" data-episode-no>；
// 阅读页图片 <img class="_images" data-url>。详情 URL 用 /episodeList?titleNo=N
// （301 到规范页，Rust http 客户端自动跟随）。图片 viewer URL 由 Rust 侧
// （crawler/dongman.rs）从详情页提取经 ctx.viewerUrl 传入——章节 slug 不可重建。

var API = "https://www.dongmanmanhua.cn";
var PREFIX = "dongman-";

// 分类（genre 页面 URL 的 code，2026-08-19 实测）
var GENRES = {
  "恋爱": "LOVE",
  "少年": "BOY",
  "古风": "ANCIENTCHINESE",
  "奇幻": "FANTASY",
  "搞笑": "COMEDY",
  "校园": "CAMPUS",
  "都市": "METROPOLIS",
  "治愈": "HEALING",
  "悬疑": "SUSPENSE",
  "励志": "INSPIRATIONAL"
};

// ---------- 入口 ----------

function buildUrl(op, payload, ctx) {
  var p = JSON.parse(payload || "{}");
  var c = JSON.parse(ctx || "{}");
  switch (op) {
    case "categories":
      return ""; // 静态分类列表，不经抓取
    case "search":
      return API + "/search?keyword=" + encodeURIComponent(p.keyword || "");
    case "category":
      var code = GENRES[p.label] || "";
      return code ? API + "/" + code : "";
    case "detail":
      return API + "/episodeList?titleNo=" + titleNo(p.comicId || "");
    case "images":
      if (!c.viewerUrl) return ""; // Rust 未提供 viewer URL → 不抓取
      return c.viewerUrl;
    default:
      throw new Error("未知 op: " + op);
  }
}

function parse(op, input, ctx) {
  var c = JSON.parse(ctx || "{}");
  switch (op) {
    case "categories":
      return JSON.stringify(genreLabels());
    case "search":
    case "category":
      return JSON.stringify(parseCards(input));
    case "detail":
      return JSON.stringify(parseDetail(input, c.titleNo || ""));
    case "images":
      return JSON.stringify(parseViewer(input));
    default:
      throw new Error("未知 op: " + op);
  }
}

function genreLabels() {
  var out = [];
  for (var k in GENRES) out.push(k);
  return out;
}

function titleNo(comicId) {
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

// key 后紧跟的连续数字（如 'data-title-no="1418"' -> "1418"）
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

function textOf(body, tag, cls) {
  var open = cls ? "<" + tag + ' class="' + cls + '">' : "<" + tag + ">";
  var a = body.indexOf(open);
  if (a < 0) return "";
  var b = a + open.length;
  var c = body.indexOf("</" + tag + ">", b);
  return c < 0 ? "" : collapse(body.slice(b, c));
}

function imgAlt(body) {
  var t = firstImgTag(body);
  return t ? collapse(attr(t, "alt")) : "";
}

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

function metaContent(html, property) {
  var items = blocks(html, "meta");
  for (var i = 0; i < items.length; i++) {
    if (attr(items[i].tag, "property") === property) return attr(items[i].tag, "content");
  }
  return "";
}

// ---------- 搜索/分类：系列卡片 ----------
//
// <ul class="card_lst"><li id="title_li_{N}" data-title-no="{N}">
//   <a href="…" class="card_item"><img src="{封面}"><div class="info">
//     <p class="subj">{标题}</p><p class="author">{作者}</p></div></a></li>
// 用 data-title-no 过滤（首页分类榜单同构 li 无此属性，避免混入）。

function parseCards(html) {
  var out = [];
  var seen = {};
  var items = blocks(html, "li");
  for (var i = 0; i < items.length; i++) {
    var b = items[i];
    var n = digitsAfter(b.tag, 'data-title-no="');
    if (!n || seen[n]) continue;
    seen[n] = true;
    out.push({
      id: PREFIX + n,
      source: "dongman",
      sourceTitle: "咚漫",
      title: textOf(b.body, "p", "subj") || imgAlt(b.body) || "咚漫 " + n,
      author: textOf(b.body, "p", "author"),
      intro: "",
      cover: imgCover(b.body),
      status: "serial",
      updateTime: "",
      lastChapter: "",
      tags: [],
      lastReadChapter: 0,
      lastReadTime: 0,
    });
    if (out.length >= 24) break;
  }
  return out;
}

// ---------- 详情页 ----------

function parseDetail(html, titleNo) {
  var title =
    textOf(html, "h1", "subj") ||
    textOf(html, "h1", "") ||
    textOf(html, "title", "") ||
    "咚漫 " + titleNo;
  var cover = metaContent(html, "og:image");
  if (cover.indexOf("http://") === 0) cover = "https://" + cover.slice(7);
  var chapters = parseChapters(html);
  return {
    comic: {
      id: PREFIX + titleNo,
      source: "dongman",
      sourceTitle: "咚漫",
      title: title,
      author: authorsOf(html),
      intro: collapse(stripTags(textOf(html, "p", "summary"))),
      cover: cover,
      status: "serial",
      updateTime: "",
      lastChapter: chapters.length ? chapters[0].title : "",
      tags: [],
      lastReadChapter: 0,
      lastReadTime: 0,
    },
    chapters: chapters,
  };
}

// <span class="author">作者<a …>作家信息</a></span>（可能有多个），去「作家信息」后缀
function authorsOf(html) {
  var out = [];
  var key = '<span class="author">';
  var i = 0;
  for (;;) {
    var s = html.indexOf(key, i);
    if (s < 0) break;
    var e = html.indexOf("</span>", s);
    if (e < 0) break;
    var t = collapse(stripTags(html.slice(s + key.length, e)));
    t = t.split("作家信息")[0];
    t = collapse(t);
    if (t) out.push(t);
    i = e + "</span>".length;
  }
  return out.join(", ");
}

// <a href="…/viewer?…&episode_no=N">…<span class="subj"><span>{标题}</span></span>
// → 章节（按 index 降序，最新在前；viewer URL 由 Rust 从同页提取，脚本不重建）
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
      title: subjText(b.body) || imgAlt(b.body) || "第 " + ep + " 话",
      pages: [],
      external: false,
      downloaded: false,
      read: false,
    });
  }
  out.sort(function (a, b) {
    return b.index - a.index;
  });
  return out;
}

// <span class="subj"><span>{标题}</span></span> 的内层 span 文本
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

// ---------- 阅读页：图片 ----------
//
// <img class="_images _centerImg" data-url="https://cdn.dongmanmanhua.cn/…">

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
