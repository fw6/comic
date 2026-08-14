// cimoc.crawl — 爬虫引擎入口，调用 Rust 核心（cimoc-core）做抓取 + 解析。
// 后台线程执行（网络 I/O 不阻塞主线程），失败经 callback.onFailure 返回。
package com.tiktok.sparkling.methods.cimoc.crawl

import com.tiktok.sparkling.method.registry.core.BridgePlatformType
import com.tiktok.sparkling.method.registry.core.IDLBridgeMethod
import com.tiktok.sparkling.method.registry.core.model.idl.CompletionBlock
import com.tiktok.sparkling.method.registry.core.utils.createXModel
import com.tiktok.sparkling.methods.cimoc.cimoc.crawl.AbsCrawlMethodIDL
import com.tiktok.sparkling.methods.cimoc.rust.RustCore

class CimocCrawlMethod : AbsCrawlMethodIDL() {
    override fun handle(
        params: IDLMethodCrawlInputModel,
        callback: CompletionBlock<IDLMethodCrawlResultModel>,
        type: BridgePlatformType,
    ) {
        Thread {
            try {
                val json = RustCore.crawl(params.op, params.sourceId, params.payload)
                callback.onSuccess(
                    IDLMethodCrawlResultModel::class.java.createXModel().apply {
                        this.json = json
                    },
                )
            } catch (e: Exception) {
                callback.onFailure(IDLBridgeMethod.FAIL, e.message ?: e.toString())
            }
        }.start()
    }
}
