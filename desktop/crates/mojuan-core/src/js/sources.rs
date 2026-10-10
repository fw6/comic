//! 内置源脚本：取自源注册表（`crawler/sources`，每个源在自己的 adapter 文件里声明脚本）。
//! 随 app 打包；debug 构建可改读磁盘——改脚本重启 app 即生效，不重编 Rust（#17 开发回路）。

use crate::crawler::sources;

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
    sources::get(source).map(|s| s.script().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_registered_source_loads_its_script() {
        for (id, src) in sources::SOURCES {
            let script = src.script();
            assert!(!script.is_empty(), "{id} 脚本为空");
            assert_eq!(load(id).as_deref(), Some(script), "{id} load 与注册表不一致");
        }
    }

    #[test]
    fn unknown_source_has_no_script() {
        assert!(load("nope").is_none());
    }
}
