// cimoc.listKeys — 列出持久化键名（filesDir/data/*.json 文件名，移植自旧 StorageModule）。
package com.tiktok.sparkling.methods.cimoc.listKeys

import com.tiktok.sparkling.method.registry.core.BridgePlatformType
import com.tiktok.sparkling.method.registry.core.IDLBridgeMethod
import com.tiktok.sparkling.method.registry.core.model.idl.CompletionBlock
import com.tiktok.sparkling.method.registry.core.utils.createXModel
import com.tiktok.sparkling.methods.cimoc.cimoc.listkeys.AbsListKeysMethodIDL
import com.tiktok.sparkling.methods.cimoc.util.CimocNative

class CimocListKeysMethod : AbsListKeysMethodIDL() {
    override fun handle(
        params: IDLMethodListKeysInputModel,
        callback: CompletionBlock<IDLMethodListKeysResultModel>,
        type: BridgePlatformType,
    ) {
        val context = getSDKContext()?.context
        if (context == null) {
            callback.onFailure(IDLBridgeMethod.FAIL, "Context not provided in host")
            return
        }
        val dir = CimocNative.storageDir(context)
        val keys = dir.list()?.filter { it.endsWith(".json") }?.map { it.removeSuffix(".json") } ?: emptyList()
        callback.onSuccess(
            IDLMethodListKeysResultModel::class.java.createXModel().apply { this.keys = keys },
        )
    }
}
