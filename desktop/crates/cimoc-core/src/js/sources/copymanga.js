// Copymanga 拷贝漫画 源脚本（2026-08-18 新增）
//
// 契约（见 cimoc-core/src/js/mod.rs）：
//   buildUrl(op, payload, ctx) -> string  —— 构造 op 请求 URL（空串 = 不抓取）
//   parse(op, input, ctx) -> JSON 字符串   —— 解析 API JSON 为 crawl 协议 JSON
// 运行环境：QuickJS（rquickjs 0.12.2），白名单 Date/Json/Eval —— 只用字符串方法，
// 不用正则/Map（research #14 修订基线）。JSON API，结构参考开源 copymanga 下载器
// （lanyeeee/copymanga-downloader）确认：comic2 详情、group 章节、chapter2 图片。
//
// Rust 侧职责（crawler/script.rs）：detail 的章节 feed、images 的 chapterUuid 由 Rust
// 经 ctx 传入（章节在 /group/{group}/chapters 独立端点，不在 comic2 响应里）；
// 请求头（platform/version/hc-lang）在 Rust fetch 层。

var API = "https://api.mangacopy.com";
var PREFIX = "copymanga-";

// 分类主题（path_word 已在本环境实测验证，2026-08-18）
var THEMES = {
  "冒险": "maoxian",
  "奇幻": "qihuan",
  "校园": "xiaoyuan",
  "百合": "baihe",
  "科幻": "kehuan",
  "耽美": "danmei",
  "搞笑": "gaoxiao",
  "悬疑": "xuanyi",
  "热血": "rexue",
  "竞技": "jingji",
  "生活": "shenghuo",
  "侦探": "zhentan",
  "战争": "zhanzheng",
  "历史": "lishi",
  "美食": "meishi",
  "武侠": "wuxia",
  "恐怖": "kongbu"
};

// ---------- 入口 ----------

function buildUrl(op, payload, ctx) {
  var p = JSON.parse(payload || "{}");
  var c = JSON.parse(ctx || "{}");
  switch (op) {
    case "search":
      return (
        API + "/api/v3/search/comic?format=json&platform=3&q=" +
        encodeURIComponent(p.keyword || "") + "&offset=0&limit=20"
      );
    case "category":
      var theme = THEMES[p.label] || "";
      var u = API + "/api/v3/comics?platform=3&limit=20&offset=0";
      return theme ? u + "&theme=" + theme : u;
    case "detail":
      return API + "/api/v3/comic2/" + pathWord(p.comicId || "") + "?platform=3";
    case "images":
      if (!c.chapterUuid) return "";
      return (
        API + "/api/v3/comic/" + pathWord(p.comicId || "") +
        "/chapter2/" + c.chapterUuid + "?platform=3"
      );
    case "categories":
      return ""; // 静态主题列表，不经抓取
    default:
      throw new Error("未知 op: " + op);
  }
}

function parse(op, input, ctx) {
  var c = JSON.parse(ctx || "{}");
  switch (op) {
    case "categories":
      return JSON.stringify(themeLabels());
    case "search":
    case "category":
      return JSON.stringify(toComics(JSON.parse(input)));
    case "detail":
      return JSON.stringify(parseDetail(JSON.parse(input), c.feed || []));
    case "images":
      return JSON.stringify(parseChapterImages(JSON.parse(input)));
    default:
      throw new Error("未知 op: " + op);
  }
}

function themeLabels() {
  var out = [];
  for (var k in THEMES) out.push(k);
  return out;
}

function pathWord(comicId) {
  return comicId.indexOf(PREFIX) === 0 ? comicId.slice(PREFIX.length) : comicId;
}

// ---------- 搜索/分类结果 ----------

function toComics(json) {
  var results = json.results || {};
  var list = results.list || [];
  var out = [];
  for (var i = 0; i < list.length; i++) out.push(toComic(list[i]));
  return out;
}

function toComic(item) {
  return {
    id: PREFIX + (item.path_word || ""),
    source: "copymanga",
    sourceTitle: "Copymanga",
    title: item.name || "",
    author: authorsName(item.author),
    intro: item.brief || "",
    cover: item.cover || "",
    status: statusFor(item.status),
    updateTime: item.datetime_updated || "",
    lastChapter: lastChapterName(item.last_chapter),
    tags: themeNames(item.theme),
    lastReadChapter: 0,
    lastReadTime: 0,
  };
}

function authorsName(authors) {
  if (!authors) return "";
  var out = [];
  for (var i = 0; i < authors.length; i++) {
    if (authors[i] && authors[i].name) out.push(authors[i].name);
  }
  return out.join(", ");
}

function themeNames(themes) {
  if (!themes) return [];
  var out = [];
  for (var i = 0; i < themes.length; i++) {
    if (themes[i] && themes[i].name) out.push(themes[i].name);
  }
  return out;
}

function lastChapterName(lc) {
  return lc ? lc.name || "" : "";
}

// status 可能是 {display:"连载中"} 或字符串；含「完结」→ finish，其余 serial
function statusFor(status) {
  if (!status) return "serial";
  var display = typeof status === "string" ? status : status.display || "";
  return display.indexOf("完结") >= 0 ? "finish" : "serial";
}

// ---------- 详情（comic2 的 comic + Rust 传入的 feed 章节） ----------

function parseDetail(json, feed) {
  var results = json.results || {};
  var node = results.comic;
  if (!node || !node.path_word) return {};
  var comic = toComic(node);
  var chapters = toChapters(feed);
  if (!comic.lastChapter && chapters.length > 0) {
    comic.lastChapter = chapters[chapters.length - 1].title;
  }
  return { comic: comic, chapters: chapters };
}

// feed 章节数组 → Chapter[]：按 index 升序、去重（同 index 保留首个）
function toChapters(feed) {
  var seen = {};
  var out = [];
  for (var i = 0; i < feed.length; i++) {
    var num = chapterNum(feed[i]);
    if (num === null) continue;
    if (seen[num]) continue;
    seen[num] = true;
    out.push({
      index: num,
      title: feed[i].name || "第 " + num + " 话",
      pages: [],
      external: false,
      downloaded: false,
      read: false,
    });
  }
  out.sort(function (a, b) {
    return a.index - b.index;
  });
  return out;
}

function chapterNum(ch) {
  var v = ch.index;
  if (v === undefined || v === null) return null;
  var n = typeof v === "string" ? parseFloat(v) : Number(v);
  if (n !== n || n === Infinity || n === -Infinity) return null;
  return n;
}

// ---------- 章节图片（chapter2 的 chapter.contents[].url） ----------

function parseChapterImages(json) {
  var results = json.results || {};
  var chapter = results.chapter;
  var contents = chapter ? chapter.contents : null;
  if (!contents || contents.length === 0) return [];
  var out = [];
  for (var i = 0; i < contents.length; i++) {
    var url = contents[i] && contents[i].url;
    if (url) out.push(url);
  }
  return out;
}

// vitest 侧加载入口（Rust 引擎读全局 buildUrl/parse，二者都在）
globalThis.__source = { buildUrl: buildUrl, parse: parse };
