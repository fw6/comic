//! cimoc-core：跨端共享的原生逻辑核心。
//!
//! 除占位函数外，承载下沉后的爬虫引擎（`crawler` 模块），经 `crawl` 方法透传给 JS。

pub mod crawler;

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

uniffi::setup_scaffolding!();

/// Android 专用：JNI 绑定（绕过 JNA，16KB page size 设备上 JNA 的 libjnidispatch.so 无法加载）。
/// 函数名需与 Kotlin 侧 `com.tiktok.sparkling.methods.cimoc.rust.RustCore` 的 external 方法一一对应。
#[cfg(target_os = "android")]
mod android {
    use jni::objects::{JObject, JString};
    use jni::sys::{jint, jstring};
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
