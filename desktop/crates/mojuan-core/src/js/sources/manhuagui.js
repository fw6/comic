// 漫画柜 manhuagui.com 源脚本（2026-08-19 新增）
//
// 契约（见 mojuan-core/src/js/mod.rs）：
//   buildUrl(op, payload, ctx) -> string  —— 构造 op 请求 URL（空串 = 不抓取）
//   parse(op, input, ctx) -> JSON 字符串   —— 解析 HTML 为 crawl 协议 JSON
// 运行环境：QuickJS（rquickjs 0.12.2），白名单 Date/Json/Eval —— 只用字符串方法，
// 不用正则/Map（research #14 修订基线，RegExp 后置）。
//
// 结构已在本环境实测验证（2026-08-19）：搜索 `.book-result ul > li.cf`；
// 详情 `.book-title h1` + `.chapter-list` 章节（href /comic/{id}/{cid}.html，cid 即章节号）；
// 阅读页图片在章节页的 p.a.c.k.e.r 打包脚本里（解包后含 {"path","files","sl"}，
// 图片 = https://us.hamreus.com{path}{file}?e={sl.e}&m={sl.m}）。
// 注意：本机（数据中心 IP）被拦章节页的图片脚本（返回剥离壳），解包逻辑按开源
// 参考（venera manhuagui.js getImgInfos）实现——需家用网络跑 live_smoke 兜底。

var API = "https://www.manhuagui.com";
var PREFIX = "manhuagui-";
var IMG_HOST = "https://us.hamreus.com";

// 分类（/list/{code}/，2026-08-19 实测；不含地区/年代/字母）
var GENRES = {
  "热血": "rexue",
  "少年": "shaonian",
  "少女": "shaonv",
  "青年": "qingnian",
  "爱情": "aiqing",
  "百合": "baihe",
  "耽美": "danmei",
  "后宫": "hougong",
  "搞笑": "gaoxiao",
  "科幻": "kehuan",
  "奇幻": "mohuan",
  "魔法": "mofa",
  "冒险": "maoxian",
  "悬疑": "xuanyi",
  "推理": "tuili",
  "恐怖": "kongbu",
  "神鬼": "shengui",
  "历史": "lishi",
  "战争": "zhanzheng",
  "武侠": "wuxia",
  "竞技": "jingji",
  "机战": "jizhan",
  "格斗": "gedou",
  "体育": "tiyu",
  "校园": "xiaoyuan",
  "职场": "zhichang",
  "生活": "shenghuo",
  "美食": "meishi",
  "励志": "lizhi",
  "治愈": "zhiyu",
  "萌系": "mengxi",
  "伪娘": "weiniang",
  "侦探": "zhentan",
  "黑道": "heidao",
  "儿童": "ertong",
  "四格": "sige",
  "音乐": "yinyue",
  "舞蹈": "wudao"
};

// ---------- 入口 ----------

function buildUrl(op, payload, ctx) {
  var p = JSON.parse(payload || "{}");
  switch (op) {
    case "categories":
      return ""; // 静态分类列表，不经抓取
    case "search":
      return API + "/s/" + encodeURIComponent(p.keyword || "") + "_p1.html";
    case "category":
      var code = GENRES[p.label] || "";
      return code ? API + "/list/" + code + "/" : "";
    case "detail":
      return API + "/comic/" + comicNum(p.comicId || "") + "/";
    case "images":
      // 章节页：含解包后 path/files/sl 的打包脚本（章节号即章节页 href 里的 cid）
      var idx = p.chapterIndex || 0;
      return API + "/comic/" + comicNum(p.comicId || "") + "/" + idx + ".html";
    default:
      throw new Error("未知 op: " + op);
  }
}

function parse(op, input, ctx) {
  switch (op) {
    case "categories":
      return JSON.stringify(genreLabels());
    case "search":
      return JSON.stringify(parseSearch(input));
    case "detail":
      return JSON.stringify(parseDetail(input, comicNum(JSON.parse(ctx || "{}").comicId || "")));
    case "images":
      return JSON.stringify(parseChapterImages(input));
    default:
      throw new Error("未知 op: " + op);
  }
}

function genreLabels() {
  var out = [];
  for (var k in GENRES) out.push(k);
  return out;
}

// "manhuagui-43847" -> "43847"
function comicNum(comicId) {
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

function firstImgTag(body) {
  var s = body.indexOf("<img");
  if (s < 0) return "";
  var e = body.indexOf(">", s);
  return e < 0 ? "" : body.slice(s, e + 1);
}

function imgAlt(body) {
  var t = firstImgTag(body);
  return t ? collapse(attr(t, "alt")) : "";
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

// 绝对化 //host/path → https://host/path
function absUrl(u) {
  if (u.indexOf("//") === 0) return "https:" + u;
  return u;
}

// ---------- 搜索：.book-result ul > li.cf ----------
//
// <li class="cf"><div class="book-cover"><a class="bcover" href="/comic/{id}/" title="{标题}">
//   <img src="//cf.mhgui.com/cpic/b/{id}.jpg"><span class="tt">{更新}</span></a></div>
//   <div class="book-detail"><dl><dt><a href="/comic/{id}/">{标题}</a>…</dt>
//   <dd class="tags status">…<span class="red">{状态}</span>…</dd>
//   <dd class="intro"><span><strong>简介：</strong>{简介}</span></dd></dl></div></li>

function parseSearch(html) {
  var out = [];
  var seen = {};
  var items = blocks(html, "li");
  for (var i = 0; i < items.length; i++) {
    var b = items[i];
    if (b.tag.indexOf('class="cf"') < 0) continue; // 只认搜索结果 li
    var info = bcoverInfo(b.body);
    if (!info || !info.id || seen[info.id]) continue;
    seen[info.id] = true;
    var bodyText = stripTags(b.body);
    out.push({
      id: PREFIX + info.id,
      source: "manhuagui",
      sourceTitle: "漫画柜",
      title: info.title || "漫画柜 " + info.id,
      author: authorFrom(b.body),
      intro: textAfter(b.body, "简介："),
      cover: info.cover,
      status: bodyText.indexOf("已完结") >= 0 ? "finish" : "serial",
      updateTime: "",
      lastChapter: info.lastChapter,
      tags: [],
      lastReadChapter: 0,
      lastReadTime: 0,
    });
    if (out.length >= 24) break;
  }
  return out;
}

// <a class="bcover" href="/comic/{id}/">…<img src="{封面}">…<span class="tt">{最新章}</span>
function bcoverInfo(body) {
  var key = '<a class="bcover"';
  var s = body.indexOf(key);
  if (s < 0) return null;
  var e = body.indexOf(">", s);
  var tag = body.slice(s, e + 1);
  var href = attr(tag, "href");
  var parts = href.split("/");
  if (parts.length < 3 || !parts[2]) return null;
  var img = firstImgTag(body);
  var src = attr(img, "src");
  var tt = textOf(body, "span", "tt");
  return {
    id: parts[2],
    title: attr(tag, "title") || imgAlt(body),
    cover: absUrl(src),
    lastChapter: collapse(stripTags(tt)),
  };
}

// key 后文本（去标签、折叠空白）；key 未找到返回空串
function textAfter(body, key) {
  var a = body.indexOf(key);
  if (a < 0) return "";
  return collapse(stripTags(body.slice(a + key.length)));
}

// 「作者：」后第一个 <a>…</a> 的文本（搜索页用「作者：」，详情页用「漫画作者：」，
// 都含「作者：」子串）
function authorFrom(body) {
  var a = body.indexOf("作者：");
  if (a < 0) return "";
  var lt = body.indexOf("<a", a);
  if (lt < 0) return "";
  var gt = body.indexOf(">", lt);
  var c = body.indexOf("</a>", gt);
  return c < 0 ? "" : collapse(stripTags(body.slice(gt + 1, c)));
}

// ---------- 详情页 ----------

function parseDetail(html, comicId) {
  var title = textOf(html, "h1", "") || textOf(html, "title", "");
  if (title.indexOf("漫画_") >= 0) title = title.split("漫画_")[0]; // title 标签带后缀，h1 优先
  var cover = absUrl(imgInHcover(html));
  var chapters = parseChapters(html, comicId);
  return {
    comic: {
      id: PREFIX + comicId,
      source: "manhuagui",
      sourceTitle: "漫画柜",
      title: title,
      author: authorFrom(html),
      intro: introFrom(html),
      cover: cover,
      status: html.indexOf("已完结") >= 0 ? "finish" : "serial",
      updateTime: "",
      lastChapter: chapters.length ? chapters[chapters.length - 1].title : "",
      tags: [],
      lastReadChapter: 0,
      lastReadTime: 0,
    },
    chapters: chapters,
  };
}

// <div id="intro-all" …><p>…</p></div> 的内容（取开标签到 </div> 之间）
function introFrom(html) {
  var key = 'id="intro-all"';
  var a = html.indexOf(key);
  if (a < 0) return "";
  var gt = html.indexOf(">", a);
  if (gt < 0) return "";
  var c = html.indexOf("</div>", gt);
  return c < 0 ? "" : collapse(stripTags(html.slice(gt + 1, c)));
}

// <p class="hcover"><img src="//cf.mhgui.com/cpic/h/{id}.jpg">
function imgInHcover(html) {
  var key = '<p class="hcover">';
  var s = html.indexOf(key);
  if (s < 0) return "";
  var e = html.indexOf("</p>", s);
  var body = e < 0 ? html.slice(s) : html.slice(s, e);
  return attr(firstImgTag(body), "src");
}

// 本漫画章节：<div class="chapter-list">…<a href="/comic/{comicId}/{cid}.html" title="{标题}">
// 按 href 里 /comic/{comicId}/ 过滤（同类推荐里其它漫画的 /comic/{other}/ 不进来）；
// cid 即章节号（chapterIndex 同值，images 用它拼章节页 URL）。去重、按 cid 升序。
function parseChapters(html, comicId) {
  var out = [];
  var seen = {};
  var prefix = "/comic/" + comicId + "/";
  var items = blocks(html, "a");
  for (var i = 0; i < items.length; i++) {
    var b = items[i];
    var href = attr(b.tag, "href");
    var p = href.indexOf(prefix);
    if (p < 0) continue;
    var rest = href.slice(p + prefix.length);
    if (rest.indexOf(".html") !== rest.length - 5) continue;
    var cid = rest.slice(0, rest.length - 5);
    if (!cid || seen[cid]) continue;
    var num = Number(cid);
    if (num !== num || num <= 0) continue;
    // 真实章节链接都带 title 属性；章节栏「更新至」快捷链接（同 href、无 title）跳过
    var t = attr(b.tag, "title");
    if (!t) continue;
    seen[cid] = true;
    out.push({
      index: num,
      title: t || "第 " + cid + " 话",
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

// ---------- 章节图片：解包 p.a.c.k.e.r，取 path/files/sl ----------

function parseChapterImages(html) {
  var marker = "eval(function(p,a,c,k,e,d)";
  var m = html.indexOf(marker);
  if (m < 0) return [];
  var packed = html.slice(m);
  var text = unpackPacker(packed);
  if (!text) return [];
  var path = jsonString(text, "path");
  var files = jsonArray(text, "files");
  var e = jsonString(text, "e");
  var mm = jsonString(text, "m");
  if (!path || files.length === 0) return [];
  var out = [];
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    var url = IMG_HOST + path + f;
    if (e || mm) url += "?e=" + e + "&m=" + mm;
    out.push(url);
  }
  return out;
}

// 解 p.a.c.k.e.r 打包文本（无正则；算法与来源脚本一致，2026-08-19 用漫画人真实页验证）
function unpackPacker(script) {
  var pStart = script.indexOf("}('");
  if (pStart < 0) return "";
  pStart += 3;
  // p 串：到 "',N,N,'"
  var b0 = script.indexOf("',", pStart);
  if (b0 < 0) return "";
  var p = script.slice(pStart, b0);
  var i = b0 + 2;
  var aStr = readDigits(script, i);
  i += aStr.length;
  if (script[i] === ",") i++;
  var cStr = readDigits(script, i);
  i += cStr.length;
  if (script[i] === ",") i++;
  if (script[i] === "'") i++;
  var kEndMarker = "'.split('|')";
  var kEnd = script.indexOf(kEndMarker, i);
  if (kEnd < 0) return "";
  var k = script.slice(i, kEnd).split("|");
  var a = Number(aStr);
  var c = Number(cStr);
  if (!a || !c) return "";
  var d = {};
  var chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (var cc = 0; cc < c; cc++) {
    var key = packerKey(cc, a, chars);
    d[key] = k[cc] || key;
  }
  // 令牌替换：\w = [A-Za-z0-9_]
  var out = "";
  var buf = "";
  var token = false;
  for (var j = 0; j < p.length; j++) {
    var ch = p[j];
    var isWord = isWordChar(ch);
    if (isWord !== token) {
      if (token) out += d[buf] !== undefined ? d[buf] : buf;
      else out += buf;
      buf = ch;
      token = isWord;
    } else {
      buf += ch;
    }
  }
  if (buf) out += token ? (d[buf] !== undefined ? d[buf] : buf) : buf;
  return out;
}

function packerKey(c, a, chars) {
  var out = "";
  while (true) {
    var rem = c % a;
    out = (rem > 35 ? String.fromCharCode(rem + 29) : chars[rem]) + out;
    c = Math.floor(c / a);
    if (c === 0) break;
  }
  return out;
}

function isWordChar(ch) {
  return (
    (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") ||
    (ch >= "0" && ch <= "9") || ch === "_"
  );
}

function readDigits(s, i) {
  var out = "";
  while (i < s.length && s[i] >= "0" && s[i] <= "9") {
    out += s[i];
    i++;
  }
  return out;
}

// 文本里 "key":"..." 的字符串值（key 为解包后 JSON 的字段，如 path/e/m）
function jsonString(text, key) {
  var k = '"' + key + '":"';
  var a = text.indexOf(k);
  if (a < 0) return "";
  a += k.length;
  var b = text.indexOf('"', a);
  return b < 0 ? "" : text.slice(a, b);
}

// 文本里 "key":["a","b",...] 的字符串数组
function jsonArray(text, key) {
  var k = '"' + key + '":[';
  var a = text.indexOf(k);
  if (a < 0) return [];
  var out = [];
  var i = a + k.length;
  for (;;) {
    if (text[i] === '"') {
      var j = text.indexOf('"', i + 1);
      if (j < 0) break;
      out.push(text.slice(i + 1, j));
      i = j + 1;
    } else if (text[i] === "]" || text[i] === undefined) {
      break;
    } else {
      i++;
    }
  }
  return out;
}

// vitest 侧加载入口（Rust 引擎读全局 buildUrl/parse，二者都在）
globalThis.__source = { buildUrl: buildUrl, parse: parse };
