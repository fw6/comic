//! 隐藏 webview 渲染通道（Cloudflare 防护源用）。
//!
//! 宿主（src-tauri）在 setup 时经 [`set_fetcher`] 注册渲染实现：不可见 webview 加载
//! 目标 URL，等待 Cloudflare 验证与页面渲染完成后取回完整 HTML。渲染源的
//! `fetch()`（见 `script.rs`）经本通道拿到的 HTML 走与普通抓取完全相同的 parse
//! 契约，与 rquickjs 管道并存。
//!
//! 未注册宿主（cimoc-core 单独跑测试、无 webview 的进程）时 [`fetch`] 返回明确
//! 错误，由 `record_error` 呈现到前端错误行。

use std::sync::OnceLock;

type RenderFetcher = Box<dyn Fn(&str) -> Result<String, String> + Send + Sync>;

static FETCHER: OnceLock<RenderFetcher> = OnceLock::new();

/// 该源是否整源经渲染通道抓取页面（按源声明；baozimh —— Cloudflare 防护；
/// nnhanman —— 整站 TLS 连接对本机重置，普通 HTTP 客户端拿不到页面）。
pub fn needed(source: &str) -> bool {
    matches!(source, "baozimh" | "nnhanman")
}

/// 宿主注册渲染实现（进程内一次；重复注册被忽略）。
pub fn set_fetcher(f: impl Fn(&str) -> Result<String, String> + Send + Sync + 'static) {
    let _ = FETCHER.set(Box::new(f));
}

/// 渲染一个页面 URL，返回渲染后的完整 HTML。
pub fn fetch(url: &str) -> Result<String, String> {
    match FETCHER.get() {
        Some(f) => f(url),
        None => Err("渲染通道未注册（当前宿主无隐藏 webview）".to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn render_sources_declared() {
        assert!(needed("baozimh"));
        assert!(needed("nnhanman"));
        assert!(!needed("manhuagui"));
        assert!(!needed("kxmanhua"));
        assert!(!needed("hentara"));
        assert!(!needed("webtoons"));
    }

    #[test]
    fn fetch_without_fetcher_errors_clearly() {
        // 测试进程未注册宿主：错误消息可直接呈现给用户
        let err = fetch("https://example.com").unwrap_err();
        assert!(err.contains("渲染通道未注册"), "err = {err}");
    }
}
