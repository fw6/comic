// MangaDex 源脚本 —— 源运行时系统首批源（wayfinder #11/#15/#16 定案，2026-08-15）
//
// 契约（见 mojuan-core/src/js/mod.rs）：
//   buildUrl(op, payload, ctx) -> string  —— 构造 op 请求 URL（空串 = 不抓取）
//   parse(op, input, ctx) -> JSON 字符串   —— 解析 API JSON 为 crawl 协议 JSON
// 运行环境：QuickJS（rquickjs 0.12.2），白名单 Date/Json/Eval —— 只用字符串方法，
// 不用正则/Map（research #14 修订基线，RegExp 后置）。
//
// Rust 侧职责（crawler/script.rs）：categories 由 Rust 的标签缓存实现；category 的
// tagId、images 的 chapterId、detail 的 feed 由 Rust 经 ctx 传入。

var API = "https://api.mangadex.org";
var COVER_CDN = "https://uploads.mangadex.org/covers";
var CONTENT = "contentRating[]=safe&contentRating[]=suggestive";
var MANGA_PREFIX = "mangadex-";

// ---------- 入口 ----------

function buildUrl(op, payload, ctx) {
  var p = JSON.parse(payload || "{}");
  var c = JSON.parse(ctx || "{}");
  switch (op) {
    case "search":
      return (
        API + "/manga?title=" + encodeURIComponent(p.keyword || "") +
        "&limit=24&includes[]=cover_art&includes[]=author&" + CONTENT +
        "&order[relevance]=desc"
      );
    case "category":
      if (!c.tagId) return "";
      return (
        API + "/manga?includedTags[]=" + c.tagId +
        "&limit=24&includes[]=cover_art&includes[]=author&" + CONTENT
      );
    case "detail":
      return (
        API + "/manga/" + mangaId(p.comicId || "") +
        "?includes[]=author&includes[]=artist&includes[]=cover_art"
      );
    case "images":
      if (!c.chapterId) return "";
      return API + "/at-home/server/" + c.chapterId;
    case "categories":
      return ""; // Rust 侧实现（tags 缓存），不经脚本
    default:
      throw new Error("未知 op: " + op);
  }
}

function parse(op, input, ctx) {
  var c = JSON.parse(ctx || "{}");
  switch (op) {
    case "search":
    case "category":
      return JSON.stringify(toComics(JSON.parse(input)));
    case "detail":
      return JSON.stringify(parseDetail(input, c.feed || []));
    case "images":
      return JSON.stringify(parseAtHome(JSON.parse(input)));
    case "categories":
      throw new Error("categories 由 Rust 侧实现");
    default:
      throw new Error("未知 op: " + op);
  }
}

function mangaId(comicId) {
  return comicId.indexOf(MANGA_PREFIX) === 0 ? comicId.slice(MANGA_PREFIX.length) : comicId;
}

// ---------- 搜索/分类结果 ----------

function toComics(json) {
  var out = [];
  var data = json.data || [];
  for (var i = 0; i < data.length; i++) out.push(toComic(data[i]));
  return out;
}

function toComic(node) {
  var attrs = node.attributes || {};
  var id = node.id || "";
  var coverArt = rel(node, "cover_art");
  var cover = coverArt && coverArt.attributes ? coverArt.attributes.fileName : "";
  var authorRel = rel(node, "author");
  var author = authorRel && authorRel.attributes ? authorRel.attributes.name || "" : "";
  return {
    id: "mangadex-" + id,
    source: "mangadex",
    sourceTitle: "MangaDex",
    title: pickLocalized(attrs.title, "Manga"),
    author: author,
    intro: stripHtml(pickLocalized(attrs.description, "")),
    cover: cover ? COVER_CDN + "/" + id + "/" + cover + ".256.jpg" : "",
    status: attrs.status === "completed" ? "finish" : "serial",
    updateTime: "",
    lastChapter: "",
    tags: genreLabels(attrs.tags),
    lastReadChapter: 0,
    lastReadTime: 0,
  };
}

function rel(node, ty) {
  var rels = node.relationships || [];
  for (var i = 0; i < rels.length; i++) {
    if (rels[i].type === ty) return rels[i];
  }
  return null;
}

function genreLabels(tags) {
  var out = [];
  for (var i = 0; i < (tags || []).length; i++) {
    var t = tags[i];
    var attrs = t.attributes || {};
    if (attrs.group !== "genre") continue;
    var label = pickLocalized(attrs.name, "");
    if (label !== "") out.push(label);
  }
  return out;
}

function pickLocalized(map, fallback) {
  if (!map) return fallback;
  var order = ["en", "zh", "ja", "ko"];
  for (var i = 0; i < order.length; i++) {
    if (typeof map[order[i]] === "string") return map[order[i]];
  }
  for (var k in map) {
    if (typeof map[k] === "string") return map[k];
  }
  return fallback;
}

// 去 HTML 标签 + 折叠空白（同 Rust strip_html）
function stripHtml(s) {
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
  return collapse(out);
}

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

// ---------- 详情 ----------

function parseDetail(input, feed) {
  var json = JSON.parse(input);
  var node = json.data;
  if (!node || !node.id) return {};
  var comic = toComic(node);
  var chapters = toChapters(feed);
  comic.lastChapter = chapters.length ? chapters[chapters.length - 1].title : "";
  return { comic: comic, chapters: chapters };
}

// feed 章节数组 → Chapter[]（编号升序、去重、外链标记，同 Rust to_chapters）
function toChapters(feed) {
  var seen = {};
  var out = [];
  for (var i = 0; i < feed.length; i++) {
    var num = chapterNum(feed[i]);
    if (num === null) continue;
    if (seen[num]) continue;
    seen[num] = true;
    var attrs = feed[i].attributes || {};
    out.push({
      index: num,
      title: attrs.title || "第 " + num + " 话",
      pages: [],
      external: attrs.externalUrl ? true : false,
      downloaded: false,
      read: false,
    });
  }
  return out;
}

function chapterNum(ch) {
  var v = (ch.attributes || {}).chapter;
  if (v === undefined || v === null) return null;
  var n = typeof v === "string" ? parseFloat(v) : Number(v);
  if (n !== n || n === Infinity || n === -Infinity) return null;
  return n;
}

// ---------- at-home 图片 ----------

function parseAtHome(json) {
  var base = json.baseUrl;
  var ch = json.chapter || {};
  var hash = ch.hash;
  var data = ch.data || [];
  if (!base || !hash || data.length === 0) return [];
  var out = [];
  for (var i = 0; i < data.length; i++) out.push(base + "/data/" + hash + "/" + data[i]);
  return out;
}

// vitest 侧加载入口（Rust 引擎读全局 buildUrl/parse，二者都在）
globalThis.__source = { buildUrl: buildUrl, parse: parse };
