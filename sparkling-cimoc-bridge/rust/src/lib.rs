//! cimoc-core：跨端共享的原生逻辑核心。
//!
//! 承载下沉后的爬虫引擎（`crawler` 模块）与 WebDAV/下载/本地文件 IO（`native` 模块），
//! 经 uniffi（iOS）与手写 JNI（Android）透传给 JS。

pub mod crawler;
pub mod native;

/// 返回核心版本字符串（由新增的 `rustVersion` 方法透传给 JS）。
#[uniffi::export]
pub fn cimoc_version() -> String {
    "cimoc-core-rust".to_string()
}

/// 占位计算，仅用于验证 FFI 参数/返回值在两端都能正确传递。
#[uniffi::export]
pub fn cimoc_add(a: i32, b: i32) -> i32 {
    a + b
}

/// 爬虫引擎统一入口：返回 JSON 字符串（失败返回空 JSON）。
#[uniffi::export]
pub fn crawl(op: String, source: String, payload: String) -> String {
    crawler::crawl(&op, &source, &payload)
}

/// WebDAV PUT 备份：返回 JSON `{"success","status"}`。
#[uniffi::export]
pub fn webdav_put(base: String, user: String, password: String, file_name: String, content: String) -> String {
    native::webdav::webdav_put(&base, &user, &password, &file_name, &content)
}

/// WebDAV GET 读取备份：返回 JSON `{"ok","content","status","error"}`。
#[uniffi::export]
pub fn webdav_get(base: String, user: String, password: String, file_name: String) -> String {
    native::webdav::webdav_get(&base, &user, &password, &file_name)
}

/// 下载单张图片到本地目录：返回 `"true"`/`"false"`。
#[uniffi::export]
pub fn download_image(url: String, dir: String, comic_id: String, chapter_index: i64, page_index: i64) -> String {
    native::files::download_image(&url, &dir, &comic_id, chapter_index, page_index)
}

/// 已下载章节文件列表：返回 JSON `{chapterIndex: [paths]}`。
#[uniffi::export]
pub fn list_downloaded(dir: String, comic_id: String) -> String {
    native::files::list_downloaded(&dir, &comic_id)
}

/// 扫描本地已下载漫画：返回 JSON `[{comicId, chapterCount}]`。
#[uniffi::export]
pub fn scan_local(dir: String) -> String {
    native::files::scan_local(&dir)
}

uniffi::setup_scaffolding!();

/// Android 专用：JNI 绑定（绕过 JNA，16KB page size 设备上 JNA 的 libjnidispatch.so 无法加载）。
/// 函数名需与 Kotlin 侧 `com.tiktok.sparkling.methods.cimoc.rust.RustCore` 的 external 方法一一对应。
#[cfg(target_os = "android")]
mod android {
    use jni::objects::{JObject, JString};
    use jni::sys::{jint, jlong, jstring};
    use jni::JNIEnv;

    #[no_mangle]
    pub extern "system" fn Java_com_tiktok_sparkling_methods_cimoc_rust_RustCore_nativeVersion<
        'local,
    >(
        env: JNIEnv<'local>,
        _this: JObject<'local>,
    ) -> jstring {
        match env.new_string(crate::cimoc_version()) {
            Ok(v) => v.into_raw(),
            Err(_) => std::ptr::null_mut(),
        }
    }

    #[no_mangle]
    pub extern "system" fn Java_com_tiktok_sparkling_methods_cimoc_rust_RustCore_nativeAdd<'local>(
        _env: JNIEnv<'local>,
        _this: JObject<'local>,
        a: jint,
        b: jint,
    ) -> jint {
        crate::cimoc_add(a, b)
    }

    #[no_mangle]
    pub extern "system" fn Java_com_tiktok_sparkling_methods_cimoc_rust_RustCore_nativeCrawl<
        'local,
    >(
        mut env: JNIEnv<'local>,
        _this: JObject<'local>,
        op: JString<'local>,
        source: JString<'local>,
        payload: JString<'local>,
    ) -> jstring {
        let op: String = match env.get_string(&op) {
            Ok(s) => s.to_string_lossy().into_owned(),
            Err(_) => return std::ptr::null_mut(),
        };
        let source: String = match env.get_string(&source) {
            Ok(s) => s.to_string_lossy().into_owned(),
            Err(_) => return std::ptr::null_mut(),
        };
        let payload: String = match env.get_string(&payload) {
            Ok(s) => s.to_string_lossy().into_owned(),
            Err(_) => return std::ptr::null_mut(),
        };
        let result = crate::crawl(op, source, payload);
        match env.new_string(result) {
            Ok(v) => v.into_raw(),
            Err(_) => std::ptr::null_mut(),
        }
    }

    fn read_string(env: &mut JNIEnv, s: &JString) -> Option<String> {
        env.get_string(s).ok().map(|v| v.to_string_lossy().into_owned())
    }

    fn to_jstring(env: &mut JNIEnv, s: String) -> jstring {
        env.new_string(s).map(|v| v.into_raw()).unwrap_or(std::ptr::null_mut())
    }

    #[no_mangle]
    pub extern "system" fn Java_com_tiktok_sparkling_methods_cimoc_rust_RustCore_nativeWebdavPut<
        'local,
    >(
        mut env: JNIEnv<'local>,
        _this: JObject<'local>,
        base: JString<'local>,
        user: JString<'local>,
        password: JString<'local>,
        file_name: JString<'local>,
        content: JString<'local>,
    ) -> jstring {
        let (Some(base), Some(user), Some(password), Some(file_name), Some(content)) = (
            read_string(&mut env, &base),
            read_string(&mut env, &user),
            read_string(&mut env, &password),
            read_string(&mut env, &file_name),
            read_string(&mut env, &content),
        ) else {
            return std::ptr::null_mut();
        };
        to_jstring(&mut env, crate::webdav_put(base, user, password, file_name, content))
    }

    #[no_mangle]
    pub extern "system" fn Java_com_tiktok_sparkling_methods_cimoc_rust_RustCore_nativeWebdavGet<
        'local,
    >(
        mut env: JNIEnv<'local>,
        _this: JObject<'local>,
        base: JString<'local>,
        user: JString<'local>,
        password: JString<'local>,
        file_name: JString<'local>,
    ) -> jstring {
        let (Some(base), Some(user), Some(password), Some(file_name)) = (
            read_string(&mut env, &base),
            read_string(&mut env, &user),
            read_string(&mut env, &password),
            read_string(&mut env, &file_name),
        ) else {
            return std::ptr::null_mut();
        };
        to_jstring(&mut env, crate::webdav_get(base, user, password, file_name))
    }

    #[no_mangle]
    pub extern "system" fn Java_com_tiktok_sparkling_methods_cimoc_rust_RustCore_nativeDownloadImage<
        'local,
    >(
        mut env: JNIEnv<'local>,
        _this: JObject<'local>,
        url: JString<'local>,
        dir: JString<'local>,
        comic_id: JString<'local>,
        chapter_index: jlong,
        page_index: jlong,
    ) -> jstring {
        let (Some(url), Some(dir), Some(comic_id)) = (
            read_string(&mut env, &url),
            read_string(&mut env, &dir),
            read_string(&mut env, &comic_id),
        ) else {
            return std::ptr::null_mut();
        };
        to_jstring(
            &mut env,
            crate::download_image(url, dir, comic_id, chapter_index, page_index),
        )
    }

    #[no_mangle]
    pub extern "system" fn Java_com_tiktok_sparkling_methods_cimoc_rust_RustCore_nativeListDownloaded<
        'local,
    >(
        mut env: JNIEnv<'local>,
        _this: JObject<'local>,
        dir: JString<'local>,
        comic_id: JString<'local>,
    ) -> jstring {
        let (Some(dir), Some(comic_id)) =
            (read_string(&mut env, &dir), read_string(&mut env, &comic_id))
        else {
            return std::ptr::null_mut();
        };
        to_jstring(&mut env, crate::list_downloaded(dir, comic_id))
    }

    #[no_mangle]
    pub extern "system" fn Java_com_tiktok_sparkling_methods_cimoc_rust_RustCore_nativeScanLocal<
        'local,
    >(
        mut env: JNIEnv<'local>,
        _this: JObject<'local>,
        dir: JString<'local>,
    ) -> jstring {
        let Some(dir) = read_string(&mut env, &dir) else {
            return std::ptr::null_mut();
        };
        to_jstring(&mut env, crate::scan_local(dir))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_is_correct() {
        assert_eq!(cimoc_version(), "cimoc-core-rust");
    }

    #[test]
    fn add_works() {
        assert_eq!(cimoc_add(2, 3), 5);
    }
}
