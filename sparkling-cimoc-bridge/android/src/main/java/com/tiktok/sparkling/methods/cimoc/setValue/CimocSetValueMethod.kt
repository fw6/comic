// cimoc.setValue — 持久化 JSON 字符串到 filesDir/data/<key>.json（移植自旧 StorageModule）。
package com.tiktok.sparkling.methods.cimoc.setValue

import com.tiktok.sparkling.method.registry.core.BridgePlatformType
import com.tiktok.sparkling.method.registry.core.IDLBridgeMethod
import com.tiktok.sparkling.method.registry.core.model.idl.CompletionBlock
import com.tiktok.sparkling.method.registry.core.utils.createXModel
import com.tiktok.sparkling.methods.cimoc.cimoc.setvalue.AbsSetValueMethodIDL
import com.tiktok.sparkling.methods.cimoc.util.CimocNative
import java.io.File

class CimocSetValueMethod : AbsSetValueMethodIDL() {
    override fun handle(
        params: IDLMethodSetValueInputModel,
        callback: CompletionBlock<IDLMethodSetValueResultModel>,
        type: BridgePlatformType,
    ) {
        val context = getSDKContext()?.context
        if (context == null) {
            callback.onFailure(IDLBridgeMethod.FAIL, "Context not provided in host")
            return
        }
        val ok =
            try {
                val file = File(CimocNative.storageDir(context), "${params.key}.json")
                file.writeText(params.value)
                true
            } catch (e: Exception) {
                callback.onFailure(IDLBridgeMethod.FAIL, e.message ?: e.toString())
                return
            }
        callback.onSuccess(
            IDLMethodSetValueResultModel::class.java.createXModel().apply { success = ok },
        )
    }
}
