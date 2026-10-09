// 鸟鸟韩漫 nnhanman.xyz 源脚本（2026-09-30 新增）
//
// 契约（见 cimoc-core/src/js/mod.rs）：
//   buildUrl(op, payload, ctx) -> string  —— 构造 op 请求 URL（空串 = 不抓取）
//   parse(op, input, ctx) -> JSON 字符串   —— 解析 HTML 为 crawl 协议 JSON
// 运行环境：QuickJS（rquickjs 0.12.2），白名单 Date/Json/Eval —— 只用字符串方法，
// 不用正则/Map（research #14 修订基线，RegExp 后置）。
//
// 本机（数据中心 IP）对该站整站 TLS 连接被重置（curl 与 reqwest 均不通，非内容剥离），
// 故取数走隐藏 webview 渲染通道（爬取链路的默认取数路径，与 baozimh 同路）；
// 图片 CDN（new.niaopic.com / thumb.niaopic.com）无热链校验，由阅读器直接加载。
//
// 结构已在本环境实测验证（2026-09-30）：
//   列表 `<ul class="col_3_1">` 卡片（ImgA 封面锚 / txtA 标题锚 / info 日期或最新话）；
//   详情 `#Cover` 封面 + `<h1>` 标题 + txtItme 作者与题材 + `<span class="date">` 状态
//   + `<p class="txtDesc">介绍:…</p>` + 章节锚（/comic/{slug}/chapter-{id}.html）；
//   章节页图片取带 data-index 的 `<img data-src>`（站内 logo 与统计像素不带）。
// 站方备用域名（nnhanman66/88.com、nnhm81/91/92.com）轮换时改 API 一处即可。

var API = "https://nnhanman.xyz";
var PREFIX = "nnhanman-";

// 分类（/comics/{分类}/ob/{time|hits}/st/{all|completed|serialized}，2026-09-30 实测）
var CATS = {
  "最新更新": "/comics/all/ob/time/st/all",
  "热门": "/comics/all/ob/hits/st/all",
  "已完结": "/comics/all/ob/time/st/completed",
  "连载中": "/comics/all/ob/time/st/serialized"
};

// 题材（站内分类目录名，拼 /comics/{名}/ob/time/st/all）
var GENRES = [
  "正妹", "恋爱", "出版漫画", "肉慾", "浪漫", "大尺度", "巨乳", "有夫之婦",
  "女大生", "狗血劇", "同居", "好友", "調教", "动作", "後宮", "不倫",
  "3D", "校園", "耽美", "日漫"
];

// ---------- 入口 ----------

function buildUrl(op, payload, ctx) {
  var p = JSON.parse(payload || "{}");
  switch (op) {
    case "categories":
      return ""; // 静态分类列表，不经抓取
    case "search":
      return API + "/catalog.php?key=" + encodeURIComponent(p.keyword || "");
    case "category":
      var path = CATS[p.label];
      if (!path && GENRES.indexOf(p.label) >= 0) path = "/comics/" + p.label + "/ob/time/st/all";
      return path ? API + encodeURIComponent(path).split("%2F").join("/") : "";
    case "detail":
      return API + "/comic/" + slug(p.comicId || "") + ".html";
    case "images":
      return API + "/comic/" + slug(p.comicId || "") + "/chapter-" + (p.chapterIndex || 0) + ".html";
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
    case "category":
      return JSON.stringify(parseCards(input));
    case "detail":
      return JSON.stringify(parseDetail(input, slug(c.comicId || "")));
    case "images":
      return JSON.stringify(parseChapterImages(input));
    default:
      throw new Error("未知 op: " + op);
  }
}

function catLabels() {
  var out = [];
  for (var k in CATS) out.push(k);
  for (var i = 0; i < GENRES.length; i++) out.push(GENRES[i]);
  return out;
}

// "nnhanman-zui-bang-de-ta" -> "zui-bang-de-ta"
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

// 含 marker 的元素的 {open, inner, end}：marker 如 'class="info"'、'<img'
// 无闭合标签的元素（img 等）inner 为空串、end 落在开标签之后
function elementWith(body, marker, from) {
  var a = body.indexOf(marker, from || 0);
  if (a < 0) return null;
  var s = marker.indexOf("<") === 0 ? a : body.lastIndexOf("<", a);
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

// 含 marker 的元素的内层纯文本
function textOfElement(body, marker, from) {
  var el = elementWith(body, marker, from);
  return el ? collapse(stripTags(el.inner)) : "";
}

// 含 marker 的元素的属性值
function attrOfElement(body, marker, name, from) {
  var el = elementWith(body, marker, from);
  return el ? attr(el.open, name) : "";
}

// 含 from 的标签起、到 to 前的片段（from 所在标签的起始 < 也包含在内）
function sliceBetween(body, from, to) {
  var m = body.indexOf(from);
  if (m < 0) return "";
  var end = to ? body.indexOf(to, m + from.length) : -1;
  var start = body.lastIndexOf("<", m);
  if (start < 0) start = m;
  return end < 0 ? body.slice(start) : body.slice(start, end);
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

// ---------- 搜索/分类：漫画卡片 ----------
//
// <ul class="col_3_1"><li>
//   <a class="ImgA" href="/comic/{slug}.html" title="{标题}"><picture>…<img src="{封面}" …></picture></a>
//   <a class="txtA" href="/comic/{slug}.html" title="{标题}">{标题}</a>
//   <span class="info">2026-09-29</span>（首页「最近更新」位是最新话链接）
// </li>…</ul>

function parseCards(html) {
  var out = [];
  var seen = {};
  var lists = splitOn(html, '<ul class="col_3_1">');
  for (var i = 0; i < lists.length; i++) {
    var items = splitOn(lists[i].split("</ul>")[0], "<li>");
    for (var j = 0; j < items.length; j++) {
      var item = items[j];
      var cover = elementWith(item, 'class="ImgA"');
      if (!cover) continue;
      var id = slugFromHref(attr(cover.open, "href"));
      if (!id || seen[id]) continue;
      seen[id] = true;
      var title = attr(cover.open, "title") || textOfElement(item, 'class="txtA"');
      if (!title) title = attrOfElement(item, "<img", "alt");
      var info = textOfElement(item, 'class="info"');
      out.push({
        id: PREFIX + id,
        source: "nnhanman",
        sourceTitle: "鸟鸟韩漫",
        title: title || id,
        author: "",
        intro: "",
        cover: attrOfElement(item, "<img", "src"),
        status: "serial",
        updateTime: "",
        // 列表页 info 是更新日期，首页「最近更新」位才是最新话标题
        lastChapter: info.indexOf("话") >= 0 || info.indexOf("話") >= 0 ? info : "",
        tags: [],
        lastReadChapter: 0,
        lastReadTime: 0,
      });
    }
  }
  return out;
}

// "/comic/zui-bang-de-ta.html" -> "zui-bang-de-ta"（章节等其它链接返回空）
function slugFromHref(href) {
  var key = "/comic/";
  if (href.indexOf(key) !== 0) return "";
  var rest = href.slice(key.length);
  if (rest.indexOf(".html") < 0 || rest.indexOf("/") >= 0) return "";
  return rest.split(".html")[0];
}

// ---------- 详情页 ----------

function parseDetail(html, id) {
  var chapters = parseChapters(html, id);
  var title = textOfElement(html, "<h1").split("《").join("").split("》").join("");
  var statusText = textOfElement(html, 'class="date"');
  return {
    comic: {
      id: PREFIX + id,
      source: "nnhanman",
      sourceTitle: "鸟鸟韩漫",
      title: title || id,
      author: authorFrom(html),
      intro: introFrom(html),
      cover: attrOfElement(sliceBetween(html, 'id="Cover"', 'class="sub_r"'), "<img", "src"),
      status: statusText.indexOf("已完结") >= 0 ? "finish" : "serial",
      updateTime: "",
      lastChapter: chapters.length ? chapters[chapters.length - 1].title : "",
      tags: genresFrom(html),
      lastReadChapter: 0,
      lastReadTime: 0,
    },
    chapters: chapters,
  };
}

// 作者：h1 之后第一个 txtItme（图标 span 之后的文本）
function authorFrom(html) {
  var h1 = elementWith(html, "<h1");
  if (!h1) return "";
  return textOfElement(html, 'class="txtItme"', h1.end);
}

// 简介：<p class="txtDesc autoHeight">介绍:{简介}</p>
function introFrom(html) {
  return textOfElement(html, 'class="txtDesc').split("介绍:").join("");
}

// 题材：详情信息区 /comics/{名} 链接的文本
function genresFrom(html) {
  var out = [];
  var region = sliceBetween(html, 'class="txtItme"', 'class="date"');
  var i = 0;
  for (;;) {
    var a = region.indexOf("<a", i);
    if (a < 0) break;
    var gt = region.indexOf(">", a);
    var close = region.indexOf("</a>", gt);
    if (gt < 0 || close < 0) break;
    if (attr(region.slice(a, gt + 1), "href").indexOf("/comics/") === 0) {
      var t = collapse(stripTags(region.slice(gt + 1, close)));
      if (t) out.push(t);
    }
    i = close + 4;
  }
  return out;
}

// 章节：<div id="list"> 里 <ul id="mh-chapter-list-ol-0"> 的
// <a href="/comic/{slug}/chapter-{id}.html"><span>{标题}</span></a>，
// 章节 id 即 chapterIndex（images 用它拼章节页 URL）；去重后按 id 升序。
// 只取章节容器（详情页别处还有「开始阅读」链到首话的按钮，标题会是「开始阅读」）。
function parseChapters(html, id) {
  var region = sliceBetween(html, 'id="mh-chapter-list-ol-0"', "</ul>");
  var out = chaptersIn(region, id);
  if (out.length === 0) out = chaptersIn(html, id); // 容器缺失（站方改版）兜底整页扫描
  out.sort(function (a, b) {
    return a.index - b.index;
  });
  return out;
}

function chaptersIn(region, id) {
  var out = [];
  var seen = {};
  var prefix = "/comic/" + id + "/chapter-";
  var i = 0;
  for (;;) {
    var a = region.indexOf("<a", i);
    if (a < 0) break;
    var gt = region.indexOf(">", a);
    var close = gt < 0 ? -1 : region.indexOf("</a>", gt);
    if (gt < 0 || close < 0) break;
    var href = attr(region.slice(a, gt + 1), "href");
    if (href.indexOf(prefix) === 0) {
      var cid = Number(href.slice(prefix.length).split(".html")[0]);
      if (cid > 0 && !seen[cid]) {
        seen[cid] = true;
        out.push({
          index: cid,
          title: collapse(stripTags(region.slice(gt + 1, close))) || "第" + cid + "話",
          pages: [],
          external: false,
          downloaded: false,
          read: false,
        });
      }
    }
    i = close + 4;
  }
  return out;
}

// ---------- 章节页：图片 ----------
//
// <img width="728" data-src="{图片}" data-index="0" alt="…" src="{图片}">

function parseChapterImages(html) {
  var out = [];
  var seen = {};
  var i = 0;
  for (;;) {
    var img = elementWith(html, "<img", i);
    if (!img) break;
    if (img.open.indexOf("data-index=") >= 0) {
      var u = attr(img.open, "data-src") || attr(img.open, "src");
      if (u && !seen[u]) {
        seen[u] = true;
        out.push(u);
      }
    }
    i = img.end;
  }
  return out;
}

// vitest 侧加载入口（Rust 引擎读全局 buildUrl/parse，二者都在）
globalThis.__source = { buildUrl: buildUrl, parse: parse };
