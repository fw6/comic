// demo 源脚本 —— Rust↔JS 契约原型（wayfinder #15）
//
// 全局函数：parse(op, input, ctx) -> JSON 字符串
//   op    : "categories" | "search" | "category" | "detail" | "images"
//   input : Rust 层抓取的原始响应体（HTML 或 JSON 字符串）
//   ctx   : JSON 字符串，op 相关上下文（search/category 可为 "{}"；
//           detail/images 为 {"comicId": "demo:…", "chapterIndex": …}）
// 返回   : JSON 字符串，与现 crawl 协议一致：
//           categories -> ["…"]；search/category -> [{Comic}]
//           detail -> {comic, chapters}；images -> ["url", …]
// 出错   : throw new Error("消息")，Rust 侧捕获（见 js/mod.rs）
//
// 运行环境：QuickJS（rquickjs 0.12.2），全局只挂 Date/Json/Eval 白名单（research #14 修订）——
// 正则/Map 不可用（RegExp/MapSet 未挂），脚本用字符串方法；eval 存在但不依赖。
function parse(op, input, ctx) {
  switch (op) {
    case "categories":
      return JSON.stringify(["奇幻", "恋爱", "悬疑"]);
    case "search":
    case "category":
      return JSON.stringify(parseList(input));
    case "detail":
      return JSON.stringify(parseDetail(input, JSON.parse(ctx)));
    case "images":
      return JSON.stringify(parseImages(input));
    default:
      throw new Error("未知 op: " + op);
  }
}

// 提取标签属性：<div class="item" data-title="…" …>
function attr(attrs, name) {
  const key = name + '="';
  const a = attrs.indexOf(key);
  if (a < 0) return "";
  const b = attrs.indexOf('"', a + key.length);
  return attrs.slice(a + key.length, b);
}

// 列表页：<div class="item" data-title data-author data-cover></div>（对应 Rust webtoons 系列卡片）
function parseList(html) {
  const out = [];
  let i = 0;
  for (;;) {
    const start = html.indexOf('<div class="item"', i);
    if (start < 0) break;
    const end = html.indexOf(">", start);
    const attrs = html.slice(start, end);
    const title = attr(attrs, "data-title");
    if (title) {
      out.push({
        id: "demo:" + title,
        source: "demo",
        sourceTitle: "Demo 源",
        title: title,
        author: attr(attrs, "data-author"),
        intro: "",
        cover: attr(attrs, "data-cover"),
        status: "serial",
        updateTime: "",
        lastChapter: "",
        tags: [],
        lastReadChapter: 0,
        lastReadTime: 0,
      });
    }
    i = end;
  }
  return out;
}

// 详情页：<h1 class="title">…</h1> + <div class="ep" data-index="1">第 1 话</div>
function parseDetail(html, ctxObj) {
  const titleStart = html.indexOf('<h1 class="title">');
  const titleEnd = html.indexOf("</h1>", titleStart);
  const title = titleStart < 0 || titleEnd < 0 ? "" : html.slice(titleStart + '<h1 class="title">'.length, titleEnd).trim();
  if (!title) throw new Error("详情页未找到标题");
  const chapters = [];
  let i = 0;
  for (;;) {
    const start = html.indexOf('<div class="ep"', i);
    if (start < 0) break;
    const end = html.indexOf(">", start);
    const attrs = html.slice(start, end);
    const textEnd = html.indexOf("</div>", end);
    chapters.push({
      index: Number(attr(attrs, "data-index") || "0"),
      title: textEnd < 0 ? "" : html.slice(end + 1, textEnd).trim(),
      pages: [], // detail 阶段不填页（与现实现一致，op 协议不变）
      external: false,
      downloaded: false,
      read: false,
    });
    i = end;
  }
  const comicId = ctxObj.comicId || "demo:";
  return {
    comic: {
      id: comicId,
      source: "demo",
      sourceTitle: "Demo 源",
      title: title,
      author: "",
      intro: "",
      cover: "",
      status: "serial",
      updateTime: "",
      lastChapter: chapters.length ? String(chapters[chapters.length - 1].index) : "",
      tags: [],
      lastReadChapter: 0,
      lastReadTime: 0,
    },
    chapters: chapters,
  };
}

// 阅读页：<img src="…"> 序列
function parseImages(html) {
  const out = [];
  let i = 0;
  for (;;) {
    const start = html.indexOf('<img src="', i);
    if (start < 0) break;
    const end = html.indexOf('"', start + '<img src="'.length);
    out.push(html.slice(start + '<img src="'.length, end));
    i = end;
  }
  if (out.length === 0) throw new Error("阅读页未找到图片");
  return out;
}
