// cimoc.scanLocalComics — 扫描本地已下载漫画，JSON 编码 [{comicId, chapterCount}]（下沉 Rust 核心）。
package com.tiktok.sparkling.methods.cimoc.scanLocalComics

import com.tiktok.sparkling.method.registry.core.BridgePlatformType
import com.tiktok.sparkling.method.registry.core.IDLBridgeMethod
import com.tiktok.sparkling.method.registry.core.model.idl.CompletionBlock
import com.tiktok.sparkling.method.registry.core.utils.createXModel
import com.tiktok.sparkling.methods.cimoc.cimoc.scanlocalcomics.AbsScanLocalComicsMethodIDL
import com.tiktok.sparkling.methods.cimoc.rust.RustCore
import com.tiktok.sparkling.methods.cimoc.util.CimocNative

class CimocScanLocalComicsMethod : AbsScanLocalComicsMethodIDL() {
    override fun handle(
        params: IDLMethodScanLocalComicsInputModel,
        callback: CompletionBlock<IDLMethodScanLocalComicsResultModel>,
        type: BridgePlatformType,
    ) {
        val context = getSDKContext()?.context
        if (context == null) {
            callback.onFailure(IDLBridgeMethod.FAIL, "Context not provided in host")
            return
        }
        val dir = CimocNative.downloadDir(context).absolutePath
        val json = RustCore.scanLocal(dir)
        callback.onSuccess(
            IDLMethodScanLocalComicsResultModel::class.java.createXModel().apply {
                comicsJson = json
            },
        )
    }
}
