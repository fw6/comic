//
//  SparklingServiceRegistration.m
//  Cimoc (Sparkling)
//
//  兼容新版 Swift 编译器：Sparkling SDK 2.0.1 用 Swift 的
//  `@section("__DATA, SPK_PRE_SVC")` + `StaticString.utf8Start` 做服务自动注册，
//  该写法在新 Xcode（Swift 6.x）下报 "unsupported type in a constant expression"。
//  这里用 C 的 section attribute 提供相同的注册入口（类名相同），
//  并把两个 Swift 文件里的失败注册块移除。
//

#import <Foundation/Foundation.h>

__attribute__((used, section("__DATA,SPK_PRE_SVC")))
const char * const spkRegisterSPKLynxService = "SPKLynxService";

__attribute__((used, section("__DATA,SPK_PRE_SVC")))
const char * const spkRegisterSPKResourceLoaderImpl = "SPKResourceLoaderImpl";
