//! 隐藏 webview 渲染通道 —— 爬取链路的取数路径。
//!
//! 宿主在 setup 时经 [`set_fetcher`] 注册渲染实现：不可见 webview 加载目标 URL，
//! 等待 Cloudflare 验证与页面渲染完成后取回页面内容（HTML 取标记结构，JSON /
//! 纯文本接口取原始文本，见 [`HTML_SCRIPT`]）。经本通道拿到的内容交给 rquickjs
//! 的源脚本 `parse`，契约与脚本函数本身完全一致。
//!
//! 取数通道的选择（哪些源经本通道、哪些走共享 HTTP 客户端）在 `crawler::fetch`。
//!
//! 未注册宿主（cimoc-core 单独跑测试、无 webview 的进程）时 [`fetch`] 返回明确
//! 错误，由 `record_error` 呈现到前端错误行；`tests/live_smoke.rs` 因此注册一个
//! 明文 HTTP 取数器，让源结构验证不依赖界面。
//!
//! 渲染实现的「判据」集中在本模块：[`STATE_SCRIPT`] 返回页面状态，
//! [`is_clean`] 判定是否可提取，[`POLL_INTERVAL`] / [`RENDER_TIMEOUT`] 给出轮询
//! 节奏与整体超时。桌面宿主（src-tauri 的隐藏窗口）与移动端插件（Android
//! WebView / iOS WKWebView）都执行同一段 [`STATE_SCRIPT`]，各平台只负责「重复
//! 评估、连续两次干净后取 [`HTML_SCRIPT`]」的循环。挑战页的容器与标题随站点
//! 改版变动，改这里一处即可两端生效。

use std::sync::OnceLock;
use std::time::Duration;

type RenderFetcher = Box<dyn Fn(&str) -> Result<String, String> + Send + Sync>;

static FETCHER: OnceLock<RenderFetcher> = OnceLock::new();

/// 整体渲染超时（含验证挑战等待与跳转链）。
pub const RENDER_TIMEOUT: Duration = Duration::from_secs(60);

/// 页面状态轮询间隔。
pub const POLL_INTERVAL: Duration = Duration::from_millis(500);

/// 页面状态探测脚本：返回 `{rs, href, ch, denied, clean}`。
///
/// - `ch`：验证挑战页（Cloudflare 多语言「Just a moment」系标题与 challenge /
///   turnstile 容器；包子漫画 tw 域自建的 proof-of-work 验证页
///   `__gatekeeper_challenge` 资源 +「正在验证浏览器」标题，JS 算完自动跳转）；
/// - `denied`：Cloudflare 1020 拒绝页（立即失败，不空耗超时）；
/// - `clean`：目标文档 DOM 解析完成、无挑战、无拒绝、已离开 about:blank，
///   即可以提取内容。`readyState` 接受 `interactive`：阅读器页有长时间挂起的
///   子资源（统计/广告脚本），`complete` 可能永远不来；`interactive` = 主文档
///   解析完成，内容已可取。
pub const STATE_SCRIPT: &str = r#"(function () {
  var rs = document.readyState;
  var href = location.href;
  var ch = !!(document.querySelector('#challenge-form, #challenge-running, #challenge-stage, #turnstile-wrapper, cf-chl-widget, #challenge-turnstile, link[href*="gatekeeper"], script[src*="gatekeeper"]')
    || /just a moment|only a moment|moment mal|un instant|attendez|请稍候|正在验证|正在驗證|verifying/i.test(document.title));
  var denied = !!(document.querySelector('.cf-error-details, #cf-error-details')
    || /attention required|access denied|error 1020/i.test(document.title));
  var clean = (rs === 'complete' || rs === 'interactive') && !ch && !denied && href.indexOf('http') === 0;
  return { rs: rs, href: href, ch: ch, denied: denied, clean: clean };
})()"#;

/// 取回页面内容的脚本（在页面稳定后评估）。
///
/// HTML 文档取 `documentElement.outerHTML`：源脚本 `parse` 需要标记结构。
/// 非 HTML 响应（JSON / 纯文本接口，如 mangadex、hentara 的静态 JSON）取
/// `body.textContent`：浏览器把这类响应渲染进 `<pre>`，`outerHTML` 会把引号等
/// 转义成 HTML 实体，原始文本只能从 `textContent` 取。`document.contentType`
/// 缺失时按 HTML 处理（默认值取 `text/html`）。
pub const HTML_SCRIPT: &str = r#"(function () {
  var ct = document.contentType || 'text/html';
  if (ct.indexOf('html') >= 0) {
    return document.documentElement.outerHTML;
  }
  var b = document.body;
  return b ? b.textContent : (document.documentElement ? document.documentElement.textContent : '');
})()"#;

/// [`STATE_SCRIPT`] 的结果是否「干净」（可以提取内容）。
pub fn is_clean(state: &serde_json::Value) -> bool {
    state
        .get("clean")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
}

/// 状态是否命中了 Cloudflare 拒绝页（错误页/访问被拒，立即失败）。
pub fn is_denied(state: &serde_json::Value) -> bool {
    state
        .get("denied")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
}

/// 宿主注册渲染实现（进程内一次；重复注册被忽略）。
pub fn set_fetcher(f: impl Fn(&str) -> Result<String, String> + Send + Sync + 'static) {
    let _ = FETCHER.set(Box::new(f));
}

/// 渲染一个页面 URL，返回渲染后的页面内容（HTML 标记结构或接口的原始文本）。
pub fn fetch(url: &str) -> Result<String, String> {
    match FETCHER.get() {
        Some(f) => f(url),
        None => Err("渲染通道未注册（当前宿主无隐藏 webview）".to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    /// 页面桩：给 `document` / `location` 装上状态脚本与提取脚本需要的字段。
    /// `hit` 是「页面里命中的元素选择器片段」，querySelector 命中它即返回节点。
    const PAGE_STUB: &str = r#"
    function page(opts) {
      var rs = opts.rs || 'complete';
      var title = opts.title || '';
      var href = opts.href || 'https://example.com/comic/1';
      var hit = opts.hit || null;
      globalThis.document = {
        readyState: rs,
        title: title,
        contentType: opts.ct,
        querySelector: function (sel) { return hit && sel.indexOf(hit) >= 0 ? { nodeType: 1 } : null; },
        body: { textContent: opts.text || '' },
        documentElement: { outerHTML: opts.html || '<html></html>', textContent: opts.text || '' }
      };
      globalThis.location = { href: href };
    }
    "#;

    /// 在 QuickJS 里加载页面桩后求值 `expr`，返回字符串结果。
    fn eval_in_page(opts: &str, expr: &str) -> String {
        let runtime = rquickjs::Runtime::new().expect("Runtime");
        let context = rquickjs::Context::full(&runtime).expect("Context");
        context.with(|cx| {
            cx.eval::<(), _>(PAGE_STUB).expect("页面桩");
            cx.eval::<(), _>(format!("page({opts})")).expect("页面");
            cx.eval::<String, _>(expr).expect("脚本")
        })
    }

    /// 跑一遍 [`STATE_SCRIPT`]，返回脚本结果。
    fn run_state_script(opts: &str) -> serde_json::Value {
        let out = eval_in_page(opts, &format!("JSON.stringify({STATE_SCRIPT})"));
        serde_json::from_str(&out).expect("状态脚本返回 JSON")
    }

    /// 跑一遍 [`HTML_SCRIPT`]，返回提取到的文本。
    fn run_html_script(opts: &str) -> String {
        eval_in_page(opts, HTML_SCRIPT)
    }

    #[test]
    fn html_script_extracts_markup_for_html_documents() {
        // 显式 text/html 与 contentType 缺失（按 HTML 处理）都取标记结构
        for opts in [
            r#"{ ct: 'text/html', html: '<html><body><a href="/x">A</a></body></html>' }"#,
            r#"{ html: '<html><body>B</body></html>' }"#,
        ] {
            let out = run_html_script(opts);
            assert!(out.starts_with("<html>"), "opts = {opts}: {out}");
        }
    }

    #[test]
    fn html_script_extracts_raw_text_for_non_html_documents() {
        // JSON 接口：浏览器渲染进 <pre>，原始文本从 body.textContent 取（引号不转义）
        let json = run_html_script(r#"{ ct: 'application/json', text: '{"data":["a","b"]}' }"#);
        assert_eq!(json, r#"{"data":["a","b"]}"#);
        let plain = run_html_script("{ ct: 'text/plain', text: 'hello' }");
        assert_eq!(plain, "hello");
    }

    #[test]
    fn fetch_without_fetcher_errors_clearly() {
        // 测试进程未注册宿主：错误消息可直接呈现给用户
        let err = fetch("https://example.com").unwrap_err();
        assert!(err.contains("渲染通道未注册"), "err = {err}");
    }

    #[test]
    fn state_script_accepts_settled_documents() {
        for rs in ["complete", "interactive"] {
            let state = run_state_script(&format!("{{ rs: '{rs}' }}"));
            assert_eq!(state["rs"], rs);
            assert!(is_clean(&state), "rs = {rs}: {state}");
            assert!(!is_denied(&state));
        }
    }

    #[test]
    fn state_script_waits_for_document_and_target() {
        // 仍在解析主文档
        assert!(!is_clean(&run_state_script("{ rs: 'loading' }")));
        // 复位阶段停在 about:blank
        assert!(!is_clean(&run_state_script(
            "{ href: 'about:blank', rs: 'complete' }"
        )));
    }

    #[test]
    fn state_script_flags_challenge_pages() {
        // Cloudflare 挑战页：标题命中，且尚未离开挑战 URL
        let cf = run_state_script("{ title: 'Just a moment...' }");
        assert_eq!(cf["ch"], true);
        assert!(!is_clean(&cf));

        // 包子漫画 tw 域自建 proof-of-work 验证页：页面里有 gatekeeper 资源
        let gatekeeper = run_state_script("{ hit: 'gatekeeper' }");
        assert_eq!(gatekeeper["ch"], true);
        assert!(!is_clean(&gatekeeper));

        // 中文标题的挑战页
        let zh = run_state_script("{ title: '正在验证浏览器' }");
        assert_eq!(zh["ch"], true);
    }

    #[test]
    fn state_script_flags_denied_pages() {
        let by_container = run_state_script("{ hit: '.cf-error-details' }");
        assert_eq!(by_container["denied"], true);
        assert!(!is_clean(&by_container));

        let by_title = run_state_script("{ title: 'Attention Required! | Cloudflare' }");
        assert_eq!(by_title["denied"], true);
        assert!(!is_clean(&by_title));
    }

    #[test]
    fn state_helpers_default_to_false() {
        assert!(!is_clean(&json!({})));
        assert!(!is_denied(&json!({})));
        assert!(is_clean(&json!({ "clean": true })));
        assert!(is_denied(&json!({ "denied": true })));
    }
}
