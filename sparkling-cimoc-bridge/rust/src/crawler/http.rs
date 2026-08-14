//! 共享阻塞 HTTP 客户端：与旧原生 NetworkModule 一致（超时、跟随重定向、自动 gzip）。
//! reqwest blocking 内部自带 tokio 运行时，可直接在方法层后台线程同步调用。

use reqwest::blocking::Client;
use std::sync::OnceLock;
use std::time::Duration;

static CLIENT: OnceLock<Client> = OnceLock::new();

fn client() -> &'static Client {
    CLIENT.get_or_init(|| {
        Client::builder()
            .connect_timeout(Duration::from_secs(15))
            .timeout(Duration::from_secs(60))
            .redirect(reqwest::redirect::Policy::limited(10))
            .build()
            .expect("build cimoc http client")
    })
}

/// GET 抓取文本；非 200 直接返回 Err（由上游按「空结果」兜底）。
pub fn get_text(url: &str, headers: &[(&str, &str)]) -> Result<String, String> {
    let mut req = client().get(url);
    for (k, v) in headers {
        req = req.header(*k, *v);
    }
    let resp = req.send().map_err(|e| e.to_string())?;
    let status = resp.status().as_u16();
    if status != 200 {
        return Err(format!("HTTP {}", status));
    }
    resp.text().map_err(|e| e.to_string())
}

/// GET 抓取 JSON；解析失败返回 Err。
pub fn get_json(url: &str, headers: &[(&str, &str)]) -> Result<serde_json::Value, String> {
    let body = get_text(url, headers)?;
    serde_json::from_str(&body).map_err(|e| e.to_string())
}

/// encodeURIComponent 的等价替代（空间用 %20，与 JS 一致）。
pub fn encode_uri_component(s: &str) -> String {
    percent_encoding::utf8_percent_encode(s, percent_encoding::NON_ALPHANUMERIC).to_string()
}
