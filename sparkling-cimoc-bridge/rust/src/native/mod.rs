//! 非爬虫的原生逻辑下沉：WebDAV 备份 + 本地下载/文件 IO。
//! 目录路径由原生侧计算后传入（Rust 不感知平台路径）。

pub mod files;
pub mod webdav;
