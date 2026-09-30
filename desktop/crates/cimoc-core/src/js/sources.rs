//! 内置源脚本（wayfinder #16/#17 定案）：随 app 打包（`include_str!`），
//! debug 构建可改读磁盘——改脚本重启 app 即生效，不重编 Rust（#17 开发回路）。

const WEBTOONS_JS: &str = include_str!("sources/webtoons.js");
const MANGADEX_JS: &str = include_str!("sources/mangadex.js");
const COMYMANGA_JS: &str = include_str!("sources/copymanga.js");
const DONGMAN_JS: &str = include_str!("sources/dongman.js");
const MANHUAGUI_JS: &str = include_str!("sources/manhuagui.js");
const BAOZIMH_JS: &str = include_str!("sources/baozimh.js");

/// debug 构建的源脚本目录：编译期烙入仓库路径（release 不烙）。
#[cfg(debug_assertions)]
fn dev_sources_dir() -> Option<&'static str> {
    Some(concat!(env!("CARGO_MANIFEST_DIR"), "/src/js/sources"))
}

/// 取源脚本：debug 且磁盘文件存在时读磁盘，否则用内置（release 恒用内置）。
pub fn load(source: &str) -> Option<String> {
    #[cfg(debug_assertions)]
    if let Some(dir) = dev_sources_dir() {
        let path = std::path::Path::new(dir).join(format!("{source}.js"));
        if path.exists() {
            if let Ok(s) = std::fs::read_to_string(&path) {
                return Some(s);
            }
        }
    }
    match source {
        "webtoons" => Some(WEBTOONS_JS.to_string()),
        "mangadex" => Some(MANGADEX_JS.to_string()),
        "copymanga" => Some(COMYMANGA_JS.to_string()),
        "dongman" => Some(DONGMAN_JS.to_string()),
        "manhuagui" => Some(MANHUAGUI_JS.to_string()),
        "baozimh" => Some(BAOZIMH_JS.to_string()),
        _ => None,
    }
}

/// 内置脚本对（sourceId, script）。
pub fn bundled() -> [(&'static str, &'static str); 6] {
    [
        ("webtoons", WEBTOONS_JS),
        ("mangadex", MANGADEX_JS),
        ("copymanga", COMYMANGA_JS),
        ("dongman", DONGMAN_JS),
        ("manhuagui", MANHUAGUI_JS),
        ("baozimh", BAOZIMH_JS),
    ]
}
