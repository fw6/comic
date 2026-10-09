// 开心看漫画 kxmanhua.com 源脚本（2026-09-30 新增）
//
// 契约（见 mojuan-core/src/js/mod.rs）：
//   buildUrl(op, payload, ctx) -> string  —— 构造 op 请求 URL（空串 = 不抓取）
//   parse(op, input, ctx) -> JSON 字符串   —— 解析 HTML 为 crawl 协议 JSON
// 运行环境：QuickJS（rquickjs 0.12.2），白名单 Date/Json/Eval —— 只用字符串方法，
// 不用正则/Map（research #14 修订基线，RegExp 后置）。
//
// 结构已在本环境实测验证（2026-09-30）：
//   列表卡片 `<div class="product__item">`（封面 data-setbg、状态 ep/epgreen、标题 h6 > a）；
//   详情 `<div class="anime__details__pic set-bg" data-setbg>` + `anime__details__title`（h3/作者）
//   + `<div class="chapter_list">` 章节锚（href /manga/{id}/detail/{章节id}，章节 id 即 chapterIndex）；
//   章节页图片 `<img src="https://img.imh99.top/webtoon/content/…">`（广告图在 /webtoon/ad-slider/，
//   按 /webtoon/content/ 过滤）。图片 CDN 无热链校验（带不带 Referer 都 200）。

var API = "https://kxmanhua.com";
var PREFIX = "kxmanhua-";

// 分类（/manga/library 的查询参数，2026-09-30 实测）
var CATS = {
  "最新上架": "/manga/library?orderby=3",
  "最近更新": "/manga/library?orderby=2",
  "人气最高": "/manga/library?orderby=1",
  "韩漫": "/manga/library?type=2",
  "日漫": "/manga/library?type=3",
  "3D漫画": "/manga/library?type=1",
  "真人漫画": "/manga/library?type=4",
  "耽美BL": "/manga/library?type=5",
  "连载中": "/manga/library?complete=3",
  "已完结": "/manga/library?complete=2"
};

// ---------- 入口 ----------

function buildUrl(op, payload, ctx) {
  var p = JSON.parse(payload || "{}");
  switch (op) {
    case "categories":
      return ""; // 静态分类列表，不经抓取
    case "search":
      return API + "/manga/search?keyword=" + encodeURIComponent(p.keyword || "");
    case "category":
      var path = CATS[p.label] || "";
      return path ? API + path : "";
    case "detail":
      return API + "/manga/" + num(p.comicId || "");
    case "images":
      // 章节 id 即章节页 URL 里的数字（详情页章节锚 href）
      return API + "/manga/" + num(p.comicId || "") + "/detail/" + (p.chapterIndex || 0);
    default:
      throw new Error("未知 op: " + op);
  }
}

function parse(op, input, ctx) {
  switch (op) {
    case "categories":
      return JSON.stringify(catLabels());
    case "search":
    case "category":
      return JSON.stringify(parseCards(input));
    case "detail":
      return JSON.stringify(parseDetail(input, num(JSON.parse(ctx || "{}").comicId || "")));
    case "images":
      return JSON.stringify(parseChapterImages(input));
    default:
      throw new Error("未知 op: " + op);
  }
}

function catLabels() {
  var out = [];
  for (var k in CATS) out.push(k);
  return out;
}

// "kxmanhua-7067" -> "7067"
function num(comicId) {
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

// 含 key 的完整标签文本（key = 属性前缀，如 'data-setbg="'）
function tagAround(body, key) {
  var a = body.indexOf(key);
  if (a < 0) return "";
  var s = body.lastIndexOf("<", a);
  var e = body.indexOf(">", a);
  return s < 0 || e < 0 ? "" : body.slice(s, e + 1);
}

// 从第 from 个字符起，首个 <tag …>…</tag> 的标签与内容
function firstElement(body, tag, from) {
  var open = "<" + tag;
  var close = "</" + tag + ">";
  var s = body.indexOf(open, from || 0);
  if (s < 0) return null;
  var e = body.indexOf(">", s);
  if (e < 0) return null;
  var c = body.indexOf(close, e);
  return { tag: body.slice(s, e + 1), body: c < 0 ? "" : body.slice(e + 1, c) };
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

// 含 from 的标签起、到 to 前的片段（from 所在标签的起始 < 也包含在内；to 缺失则到结尾）
function sliceBetween(body, from, to) {
  var m = body.indexOf(from);
  if (m < 0) return "";
  var end = body.indexOf(to, m + from.length);
  var start = body.lastIndexOf("<", m);
  if (start < 0) start = m;
  return end < 0 ? body.slice(start) : body.slice(start, end);
}

// 含 needle 的 <tag>…</tag> 的内容（needle 在该标签内；先向后找闭合，再回溯到开标签）
function textInElementWith(body, tag, needle) {
  var a = body.indexOf(needle);
  if (a < 0) return "";
  var s = body.lastIndexOf("<" + tag, a);
  var c = body.indexOf("</" + tag + ">", a);
  if (s < 0 || c < 0) return "";
  var gt = body.indexOf(">", s);
  return gt < 0 ? "" : collapse(stripTags(body.slice(gt + 1, c)));
}

// ---------- 搜索/分类：漫画卡片 ----------
//
// <div class="product__item">
//   <div class="product__item__pic set-bg" data-setbg="{封面}"
//        onclick="location.href='/manga/{id}';">
//     <div class="ep">连载</div>（完结为 epgreen）
//   </div>
//   <div class="product__item__text"><h6><a href="/manga/{id}" …>{标题}</a></h6></div>
// </div>

function parseCards(html) {
  var out = [];
  var seen = {};
  var cards = splitOn(html, '<div class="product__item">');
  for (var i = 0; i < cards.length; i++) {
    var card = cards[i];
    var href = attr(tagAround(card, "onclick="), "onclick");
    var id = digitsAfter(href, "/manga/");
    if (!id || seen[id]) continue;
    seen[id] = true;
    var h6 = firstElement(card, "h6", 0);
    var link = h6 ? firstElement(h6.body, "a", 0) : null;
    var title = link ? collapse(stripTags(link.body)) : "";
    if (!title && link) title = attr(link.tag, "title");
    var img = firstElement(card, "img", 0);
    if (!title && img) title = attr(img.tag, "alt");
    if (!title) title = "kxmanhua " + id;
    out.push({
      id: PREFIX + id,
      source: "kxmanhua",
      sourceTitle: "开心看漫画",
      title: title,
      author: "",
      intro: "",
      cover: attr(tagAround(card, "data-setbg="), "data-setbg"),
      status: statusIn(sliceBetween(card, 'class="product__item__pic', 'class="product__item__text"')),
      updateTime: "",
      lastChapter: "",
      tags: [],
      lastReadChapter: 0,
      lastReadTime: 0,
    });
  }
  return out;
}

// 从 s 起连续数字（如 '/manga/7067' -> "7067"）
function digitsAfter(s, key) {
  var a = s.indexOf(key);
  if (a < 0) return "";
  var i = a + key.length;
  var out = "";
  while (i < s.length && s[i] >= "0" && s[i] <= "9") {
    out += s[i];
    i++;
  }
  return out;
}

// ---------- 详情页 ----------

function parseDetail(html, id) {
  var titleEl = firstElement(html, "h3", 0);
  var title = titleEl ? collapse(stripTags(titleEl.body)) : "";
  if (!title) title = "kxmanhua " + id;
  var chapters = parseChapters(html, id);
  var pic = sliceBetween(html, 'class="anime__details__pic', 'class="anime__details__text"');
  return {
    comic: {
      id: PREFIX + id,
      source: "kxmanhua",
      sourceTitle: "开心看漫画",
      title: title,
      author: authorFrom(html),
      intro: introFrom(html),
      cover: attr(tagAround(pic, "data-setbg="), "data-setbg"),
      status: statusIn(pic),
      updateTime: "",
      lastChapter: chapters.length ? chapters[chapters.length - 1].title : "",
      tags: [],
      lastReadChapter: 0,
      lastReadTime: 0,
    },
    chapters: chapters,
  };
}

// 连载/完结取详情封面区（同类推荐里的其它漫画也带 ep/epgreen，不能整页找）
function statusIn(region) {
  return region.indexOf('class="epgreen"') >= 0 ? "finish" : "serial";
}

// 作者：详情标题区的 <span>作者：…</span>
function authorFrom(html) {
  var block = sliceBetween(html, 'class="anime__details__title"', 'class="anime__details__rating"');
  var text = textInElementWith(block, "span", "作者：");
  return collapse(text.split("作者：").join(""));
}

// 简介：详情信息区最后一个 <p>（评分块后、anime__details__widget 前）
function introFrom(html) {
  var end = html.indexOf('class="anime__details__widget"');
  if (end < 0) return "";
  var head = html.slice(0, end);
  var close = head.lastIndexOf("</p>");
  if (close < 0) return "";
  var open = head.lastIndexOf("<p", close);
  if (open < 0) return "";
  var gt = head.indexOf(">", open);
  return gt < 0 ? "" : collapse(stripTags(head.slice(gt + 1, close)));
}

// 章节：<div class="chapter_list"><a href="/manga/{id}/detail/{cid}" title="…">{标题}</a>…
// 章节 id 即 chapterIndex（images 用它拼章节页 URL）；链接文本是「第N话」，按 id 升序。
function parseChapters(html, id) {
  var out = [];
  var seen = {};
  var start = html.indexOf('class="chapter_list"');
  if (start < 0) return out;
  var end = html.indexOf("</div>", start);
  var block = end < 0 ? html.slice(start) : html.slice(start, end);
  var prefix = "/manga/" + id + "/detail/";
  var i = 0;
  for (;;) {
    var a = block.indexOf("<a", i);
    if (a < 0) break;
    var gt = block.indexOf(">", a);
    var close = block.indexOf("</a>", gt);
    if (gt < 0 || close < 0) break;
    var tag = block.slice(a, gt + 1);
    var href = attr(tag, "href");
    if (href.indexOf(prefix) === 0) {
      var cid = digitsAfter(href, prefix);
      if (cid && !seen[cid]) {
        seen[cid] = true;
        out.push({
          index: Number(cid),
          title: collapse(stripTags(block.slice(gt + 1, close))) || "第" + cid + "话",
          pages: [],
          external: false,
          downloaded: false,
          read: false,
        });
      }
    }
    i = close + 4;
  }
  out.sort(function (a, b) {
    return a.index - b.index;
  });
  return out;
}

// ---------- 章节页：图片 ----------
//
// <img src="https://img.imh99.top/webtoon/content/{漫画}/{章节}/{序号}_{时间戳}.webp"
//      loading="lazy" alt="开心看漫画图片列表">（广告图为 /webtoon/ad-slider/，相对路径的站内图为 /img/）

function parseChapterImages(html) {
  var out = [];
  var seen = {};
  var i = 0;
  for (;;) {
    var img = firstElement(html, "img", i);
    if (!img) break;
    var src = attr(img.tag, "src");
    if (src.indexOf("/webtoon/content/") >= 0 && !seen[src]) {
      seen[src] = true;
      out.push(src);
    }
    i = html.indexOf(img.tag, i) + img.tag.length;
  }
  return out;
}

// vitest 侧加载入口（Rust 引擎读全局 buildUrl/parse，二者都在）
globalThis.__source = { buildUrl: buildUrl, parse: parse };
