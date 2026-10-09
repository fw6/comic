// 包子漫画 cn.baozimh.com 源脚本
//
// 契约（见 mojuan-core/src/js/mod.rs）：
//   buildUrl(op, payload, ctx) -> string  —— 构造 op 请求 URL（空串 = 不抓取）
//   parse(op, input, ctx) -> JSON 字符串   —— 解析 HTML 为 crawl 协议 JSON
// 运行环境：QuickJS（rquickjs 0.12.2），白名单 Date/Json/Eval —— 只用字符串方法，
// 不用正则/Map（research #14 修订基线）。
//
// 抓取走隐藏 webview 渲染通道（crawler/render.rs，整源声明见 render::needed）：
// tw 域章节中转链带自建 proof-of-work 验证页（__gatekeeper_challenge），渲染通道
// 等验证自动完成后取回 HTML；搜索/详情/分类页在 cn 域直接可得。
//
// 页面为 AMP 服务端渲染（2026-09-30 实测转储验证）：
// - 搜索/分类卡片：<a href="/comic/{slug}" title="{标题}" class="comics-card__poster">
//   内含 <amp-img src="{封面}">（首个为真封面，其后 placeholder/fallback 为默认图）
//   与 <small class="tags text-truncate">{作者}</small>；
// - 详情：<h1 class="comics-detail__title"> / <h2 class="comics-detail__author"> /
//   tag-list spans（首个为状态）/ <p class="comics-detail__desc …">简介</p> /
//   「最新：<a>…</a>」；章节锚 <a href="/user/page_direct?comic_id={站内id}&section_slot={s}
//   &chapter_slot={n}" class="comics-chapters__item"><span>{标题}</span></a>，
//   可见区（最新 24 话，降序）与 chapters_other_list（全部，升序）有重复，需去重；
// - 阅读页（page_direct 302 链的落地页，域名随镜像轮换）：
//   <amp-img id="chapter-img-{s}-{n}" src="{图片}">，文档序即页序。
//
// detail 解析给每章输出隐藏字段 pageUrl（中转链完整 URL），Rust post_process 提取入
// 进程内缓存并剥离字段；images 的 buildUrl 从 ctx.pageUrl 取（同 dongman viewerUrl 形状）。
// 章节 index = 按 (section_slot, chapter_slot) 升序的 1 起序号（槽位跨 section 可能重复，
// 序号保证唯一；新章节追加在尾部，已有序号稳定）。

var API = "https://cn.baozimh.com";
var PREFIX = "baozimh-";

// 分类（/classify?type={code}，2026-09-30 实测；站点标签为繁体，这里给简体）
var GENRES = {
  "热血": "rexue",
  "搞笑": "gaoxiao",
  "恋爱": "lianai",
  "纯爱": "chunai",
  "古风": "gufeng",
  "异能": "yineng",
  "悬疑": "xuanyi",
  "剧情": "juqing",
  "科幻": "kehuan",
  "奇幻": "qihuan",
  "玄幻": "xuanhuan",
  "穿越": "chuanyue",
  "冒险": "mouxian",
  "推理": "tuili",
  "武侠": "wuxia",
  "格斗": "gedou",
  "战争": "zhanzheng",
  "大女主": "danuzhu",
  "都市": "dushi",
  "总裁": "zongcai",
  "后宫": "hougong",
  "日常": "richang",
  "韩漫": "hanman",
  "少年": "shaonian",
  "其他": "qita"
};

// ---------- 入口 ----------

function buildUrl(op, payload, ctx) {
  var p = JSON.parse(payload || "{}");
  var c = JSON.parse(ctx || "{}");
  switch (op) {
    case "categories":
      return ""; // 静态分类列表，不经抓取
    case "search":
      return API + "/search?q=" + encodeURIComponent(p.keyword || "");
    case "category":
      var code = GENRES[p.label] || "";
      return code
        ? API + "/classify?type=" + code + "&region=all&state=all&filter=%2a"
        : "";
    case "detail":
      return API + "/comic/" + slugOf(p.comicId || "");
    case "images":
      // detail 时缓存的章节中转链（缺失 = 无可抓取，先重进详情页重建缓存）
      return c.pageUrl || "";
    default:
      throw new Error("未知 op: " + op);
  }
}

function parse(op, input, ctx) {
  switch (op) {
    case "categories":
      return JSON.stringify(genreLabels());
    case "search":
    case "category":
      return JSON.stringify(parseCards(bodyOf(input)));
    case "detail":
      return JSON.stringify(
        parseDetail(bodyOf(input), slugOf(JSON.parse(ctx || "{}").comicId || ""))
      );
    case "images":
      return JSON.stringify(parseChapterImages(bodyOf(input)));
    default:
      throw new Error("未知 op: " + op);
  }
}

function genreLabels() {
  var out = [];
  for (var k in GENRES) out.push(k);
  return out;
}

// "baozimh-haizeiwang-x" -> "haizeiwang-x"
function slugOf(comicId) {
  return comicId.indexOf(PREFIX) === 0 ? comicId.slice(PREFIX.length) : comicId;
}

// 只解析 <body> 之后：head 内联 CSS 也含卡片/容器类名，防止误匹配
function bodyOf(html) {
  var i = html.indexOf("<body");
  return i < 0 ? html : html.slice(i);
}

// HTML 实体还原（URL 属性里的 &amp;；渲染后 DOM 只有这一种转义需要处理）
function unesc(s) {
  return s.split("&amp;").join("&");
}

// ---------- HTML 小工具（字符串方法，无正则；复用 manhuagui.js 约定） ----------

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

// 属性值：name=" 前必须是空白（排除 data-src="/[src]=" 这类包含式误匹配）
function attr(tag, name) {
  var key = name + '="';
  var i = 0;
  for (;;) {
    var a = tag.indexOf(key, i);
    if (a < 0) return "";
    var prev = a === 0 ? " " : tag.charAt(a - 1);
    if (prev === " " || prev === "\n" || prev === "\t" || prev === "\r") {
      var b = tag.indexOf('"', a + key.length);
      return b < 0 ? "" : tag.slice(a + key.length, b);
    }
    i = a + key.length;
  }
}

// marker 起始的开标签之后、closeTag 之前的纯文本
function textAfter(html, marker, closeTag) {
  var s = html.indexOf(marker);
  if (s < 0) return "";
  var ts = html.indexOf(">", s);
  if (ts < 0) return "";
  var te = html.indexOf(closeTag, ts + 1);
  if (te < 0) return "";
  return collapse(stripTags(html.slice(ts + 1, te)));
}

// 查询串参数值（href 已 unesc）
function param(href, name) {
  var key = name + "=";
  var a = href.indexOf(key);
  if (a < 0) return "";
  a += key.length;
  var b = href.indexOf("&", a);
  return b < 0 ? href.slice(a) : href.slice(a, b);
}

// ---------- 搜索 / 分类：comics-card__poster 卡片 ----------
//
// 卡片含两个并列锚（同一 href）：
//   <a href="/comic/{slug}" title="{标题}" class="comics-card__poster">…<amp-img 封面>…</a>
//   <a href="/comic/{slug}" aria-label="{标题}" class="comics-card__info">
//     <div class="comics-card__title"><h3>{标题}</h3></div>
//     <small class="tags text-truncate">{作者}</small></a>

function parseCards(html) {
  var out = [];
  var seen = {};
  var key = '<a href="/comic/';
  var i = 0;
  for (;;) {
    var s = html.indexOf(key, i);
    if (s < 0) break;
    var tagEnd = html.indexOf(">", s);
    if (tagEnd < 0) break;
    var tag = html.slice(s, tagEnd + 1);
    i = tagEnd + 1;
    if (tag.indexOf("comics-card__poster") < 0) continue;
    var href = attr(tag, "href"); // /comic/{slug}
    var slug = href.slice("/comic/".length);
    var q = slug.indexOf("?");
    if (q >= 0) slug = slug.slice(0, q);
    if (!slug || seen[slug]) continue;
    seen[slug] = true;
    var closeA = html.indexOf("</a>", tagEnd);
    var posterBody = closeA < 0 ? "" : html.slice(tagEnd + 1, closeA);
    // info 锚在同一 href 的 poster 锚之后；边界 = 下一张卡片（info 锚也是 /comic/ 链接，
    // 不能用它作界；卡片 div 类名后是空格，comics-card__title 等下划线类名不会误匹配）
    var info = cardInfo(html, tagEnd, href, html.indexOf('<div class="comics-card ', tagEnd));
    out.push({
      id: PREFIX + slug,
      source: "baozimh",
      sourceTitle: "包子漫画",
      title: unesc(attr(tag, "title")) || info.title || slug,
      author: info.author,
      intro: "",
      cover: firstAmpImgSrc(posterBody),
      status: "",
      updateTime: "",
      lastChapter: "",
      tags: [],
      lastReadChapter: 0,
      lastReadTime: 0
    });
  }
  return out;
}

// poster 锚之后的 info 锚（同一 href；超出下一张卡片则视为无）
function cardInfo(html, from, href, limit) {
  var empty = { title: "", author: "" };
  var at = html.indexOf('class="comics-card__info"', from);
  if (at < 0 || (limit >= 0 && at > limit)) return empty;
  var aStart = html.lastIndexOf("<a ", at);
  if (aStart < 0) return empty;
  var aEnd = html.indexOf(">", aStart);
  if (aEnd < 0 || attr(html.slice(aStart, aEnd + 1), "href") !== href) return empty;
  var close = html.indexOf("</a>", aEnd);
  var body = close < 0 ? "" : html.slice(aEnd + 1, close);
  return { title: textBetween(body, "<h3", "</h3>"), author: smallTagsText(body) };
}

// marker 开标签之后、closeTag 之前的纯文本
function textBetween(body, openPrefix, closeTag) {
  var s = body.indexOf(openPrefix);
  if (s < 0) return "";
  var ts = body.indexOf(">", s);
  if (ts < 0) return "";
  var te = body.indexOf(closeTag, ts + 1);
  if (te < 0) return "";
  return collapse(stripTags(body.slice(ts + 1, te)));
}

// <small class="tags text-truncate">{作者}</small>
function smallTagsText(body) {
  var s = body.indexOf('<small class="tags');
  if (s < 0) return "";
  var ts = body.indexOf(">", s);
  var te = body.indexOf("</small>", ts);
  if (ts < 0 || te < 0) return "";
  return collapse(stripTags(body.slice(ts + 1, te)));
}

// 片段内首个 <amp-img> 的 src（真封面在 placeholder/fallback 默认图之前）
function firstAmpImgSrc(fragment) {
  var s = fragment.indexOf("<amp-img");
  if (s < 0) return "";
  var e = fragment.indexOf(">", s);
  if (e < 0) return "";
  return unesc(attr(fragment.slice(s, e + 1), "src"));
}

// ---------- 详情页 ----------

function parseDetail(html, slug) {
  var chapters = parseChapters(html);
  var tags = detailTags(html);
  return {
    comic: {
      id: PREFIX + slug,
      source: "baozimh",
      sourceTitle: "包子漫画",
      title:
        textAfter(html, '<h1 class="comics-detail__title"', "</h1>") ||
        "包子漫画 " + slug,
      author: textAfter(html, '<h2 class="comics-detail__author"', "</h2>"),
      intro: textAfter(html, '<p class="comics-detail__desc', "</p>"),
      cover: detailCover(html),
      status: detailStatus(html),
      updateTime: "",
      lastChapter: latestChapterText(html),
      tags: tags,
      lastReadChapter: 0,
      lastReadTime: 0
    },
    chapters: chapters
  };
}

// de-info__box 里首个 <amp-img>（真封面；下一个是 default_cover fallback）
function detailCover(html) {
  var box = html.indexOf("de-info__box");
  if (box < 0) return "";
  var s = html.indexOf("<amp-img", box);
  if (s < 0) return "";
  var e = html.indexOf(">", s);
  if (e < 0) return "";
  return unesc(attr(html.slice(s, e + 1), "src"));
}

// tag-list：首个非空 span 为状态文本，其余为地区/类型标签
function detailTagSpans(html) {
  var out = [];
  var box = html.indexOf('class="tag-list"');
  if (box < 0) return out;
  var end = html.indexOf("</div>", box);
  var region = end < 0 ? html : html.slice(box, end);
  var i = 0;
  for (;;) {
    var s = region.indexOf('<span class="tag"', i);
    if (s < 0) break;
    var ts = region.indexOf(">", s);
    var te = region.indexOf("</span>", ts);
    if (ts < 0 || te < 0) break;
    var t = collapse(stripTags(region.slice(ts + 1, te)));
    if (t) out.push(t);
    i = te + "</span>".length;
  }
  return out;
}

function detailStatus(html) {
  var spans = detailTagSpans(html);
  var s = spans.length ? spans[0] : "";
  if (s.indexOf("完结") >= 0 || s.indexOf("完結") >= 0) return "finish";
  if (s.indexOf("连载") >= 0 || s.indexOf("連載") >= 0) return "serial";
  return "";
}

function detailTags(html) {
  return detailTagSpans(html).slice(1);
}

// 「最新：<a href="…">{标题}</a>」（用全角冒号标记：页头菜单有「最新上架」，只查「最新」会错位）
function latestChapterText(html) {
  var m = html.indexOf("最新：");
  if (m < 0) return "";
  var a = html.indexOf("<a ", m);
  if (a < 0) return "";
  var ts = html.indexOf(">", a);
  var te = html.indexOf("</a>", ts);
  if (ts < 0 || te < 0) return "";
  return collapse(stripTags(html.slice(ts + 1, te)));
}

// 章节锚（comics-chapters__item）→ 去重（可见区与 chapters_other_list 重复）→
// (section_slot, chapter_slot) 升序 → index = 1 起序号，pageUrl 为隐藏字段（Rust 提取入缓存）
function parseChapters(html) {
  var items = [];
  var seen = {};
  var key = '<a href="/user/page_direct?';
  var i = 0;
  for (;;) {
    var s = html.indexOf(key, i);
    if (s < 0) break;
    var tagEnd = html.indexOf(">", s);
    if (tagEnd < 0) break;
    var tag = html.slice(s, tagEnd + 1);
    i = tagEnd + 1;
    if (tag.indexOf("comics-chapters__item") < 0) continue;
    var href = unesc(attr(tag, "href"));
    var sec = Number(param(href, "section_slot"));
    var slot = Number(param(href, "chapter_slot"));
    if (isNaN(sec) || isNaN(slot)) continue;
    var dk = sec + ":" + slot;
    if (seen[dk]) continue;
    seen[dk] = true;
    var closeA = html.indexOf("</a>", tagEnd);
    var bodyText = closeA < 0 ? "" : html.slice(tagEnd + 1, closeA);
    items.push({
      sec: sec,
      slot: slot,
      title: collapse(stripTags(bodyText)) || "第 " + (slot + 1) + " 话",
      url: API + href
    });
  }
  items.sort(function (a, b) {
    return a.sec - b.sec || a.slot - b.slot;
  });
  var out = [];
  for (var k = 0; k < items.length; k++) {
    out.push({
      index: k + 1,
      title: items[k].title,
      pages: [],
      external: false,
      downloaded: false,
      read: false,
      pageUrl: items[k].url
    });
  }
  return out;
}

// ---------- 阅读页：图片 ----------
//
// <amp-img id="chapter-img-{s}-{n}" … src="{图片}">，文档序即页序；
// noscript 备份图 / amp-state JSON / 重载按钮里的 URL 都不是 amp-img 开标签，天然排除。

function parseChapterImages(html) {
  var out = [];
  var key = '<amp-img id="chapter-img-';
  var i = 0;
  for (;;) {
    var s = html.indexOf(key, i);
    if (s < 0) break;
    var e = html.indexOf(">", s);
    if (e < 0) break;
    i = e + 1;
    var src = unesc(attr(html.slice(s, e + 1), "src"));
    if (src) out.push(src);
  }
  return out;
}

// vitest 侧加载入口（Rust 引擎读全局 buildUrl/parse，二者都在）
globalThis.__source = { buildUrl: buildUrl, parse: parse };
