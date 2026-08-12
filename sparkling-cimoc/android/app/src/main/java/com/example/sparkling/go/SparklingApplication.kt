// Copyright (c) 2025 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
package com.example.sparkling.go

import android.app.Application
import android.util.Log

import com.facebook.drawee.backends.pipeline.Fresco
import com.facebook.imagepipeline.backends.okhttp3.OkHttpNetworkFetcher
import com.facebook.imagepipeline.core.ImagePipelineConfig
import com.facebook.imagepipeline.core.MemoryChunkType
import com.facebook.imagepipeline.memory.PoolConfig
import com.facebook.imagepipeline.memory.PoolFactory
import com.lynx.tasm.LynxEnv
import com.lynx.tasm.behavior.Behavior
import com.lynx.tasm.behavior.LynxContext
import com.lynx.tasm.behavior.ui.LynxUI
import com.tiktok.sparkling.hybridkit.HybridKit
import com.tiktok.sparkling.hybridkit.config.BaseInfoConfig
import com.tiktok.sparkling.hybridkit.config.SparklingHybridConfig
import com.tiktok.sparkling.hybridkit.config.SparklingLynxConfig
import com.tiktok.sparkling.method.registry.core.IDLBridgeMethod
import com.tiktok.sparkling.method.registry.core.SparklingBridgeManager
import com.tiktok.sparkling.method.router.close.RouterCloseMethod
import com.tiktok.sparkling.method.router.open.RouterOpenMethod
import com.tiktok.sparkling.method.router.utils.RouterProvider
import com.example.sparkling.go.BuiltinTemplateProvider
import com.example.sparkling.go.LynxInputComponent
import okhttp3.OkHttpClient


class SparklingApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        initFresco()
        initSparkling()
    }

    private fun initFresco() {
        val factory = PoolFactory(PoolConfig.newBuilder().build())
        // Webtoons 图片 CDN（pstatic.net）有热链保护：不带 Referer 返回 403。
        // 用 OkHttp 网络抓取器给图片请求补上 Referer，保证阅读器真实图片可加载。
        val okHttpClient = OkHttpClient.Builder()
            .addInterceptor { chain ->
                val request = chain.request()
                val newRequest = if (request.url.toString().contains("pstatic.net")) {
                    request.newBuilder()
                        .header("Referer", "https://www.webtoons.com/")
                        .build()
                } else {
                    request
                }
                chain.proceed(newRequest)
            }
            .build()
        val builder = ImagePipelineConfig.newBuilder(applicationContext)
            .setPoolFactory(factory)
            .setNetworkFetcher(OkHttpNetworkFetcher(okHttpClient))
            // 16KB 页大小设备上 libimagepipeline.so 未按 16KB 对齐，加载即崩溃；
            // 用 Java 字节数组内存块（BUFFER_MEMORY）绕过原生库，功能等价。
            .setMemoryChunkType(MemoryChunkType.BUFFER_MEMORY)
        Fresco.initialize(applicationContext, builder.build())
    }

    private fun initSparkling() {
        createSparklingVariantHooks().onApplicationCreate(this)
        initHybridKit()
        registerCimocModules()
        initSparklingMethods()
    }

    private fun initHybridKit() {
        HybridKit.init(this)
        val baseInfoConfig = BaseInfoConfig(isDebug = BuildConfig.DEBUG)
        val lynxConfig = SparklingLynxConfig.build(this) {
            addBehaviors(listOf(
                object : Behavior("input", false) {
                    override fun createUI(context: LynxContext?): LynxUI<*>? {
                        return LynxInputComponent(context)
                    }
                }
            ))
            setTemplateProvider(BuiltinTemplateProvider(this@SparklingApplication))
        }
        val hybridConfig = SparklingHybridConfig.build(baseInfoConfig) {
            setLynxConfig(lynxConfig)
        }
        HybridKit.setHybridConfig(hybridConfig, this)
        HybridKit.initLynxKit()
    }

    private fun registerCimocModules() {
        // Cimoc 数据链路原生桥：图源抓取 / 持久化 / 下载 / 本地扫描 / WebDAV。
        LynxEnv.inst().registerModule("NetworkModule", NetworkModule::class.java)
        LynxEnv.inst().registerModule("StorageModule", StorageModule::class.java)
        LynxEnv.inst().registerModule("DownloadModule", DownloadModule::class.java)
        LynxEnv.inst().registerModule("LocalModule", LocalModule::class.java)
        LynxEnv.inst().registerModule("WebDavModule", WebDavModule::class.java)
    }

    private fun initSparklingMethods() {
        val autolinked = registerAutolinkMethods()
        if (!autolinked) {
            SparklingBridgeManager.registerIDLMethod(RouterOpenMethod::class.java)
            SparklingBridgeManager.registerIDLMethod(RouterCloseMethod::class.java)
        }
        RouterProvider.hostRouterDepend = SparklingHostRouterDepend()
    }

    private fun registerAutolinkMethods(): Boolean {
        var registered = false
        for (module in SparklingAutolink.modules) {
            for (className in module.methodClassNames) {
                val clazz =
                    runCatching {
                        Class.forName(className).asSubclass(IDLBridgeMethod::class.java)
                    }.getOrElse { error ->
                        Log.w(TAG, "Failed to load ${module.name} method $className", error)
                        null
                    }
                if (clazz == null) continue
                SparklingBridgeManager.registerIDLMethod(clazz)
                registered = true
            }
        }
        return registered
    }

    private companion object {
        const val TAG = "SparklingApplication"
    }
}
