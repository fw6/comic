// cimoc.getValue — 读取 filesDir/data/<key>.json，缺失返回空串（移植自旧 StorageModule）。
package com.tiktok.sparkling.methods.cimoc.getValue

import com.tiktok.sparkling.method.registry.core.BridgePlatformType
import com.tiktok.sparkling.method.registry.core.IDLBridgeMethod
import com.tiktok.sparkling.method.registry.core.model.idl.CompletionBlock
import com.tiktok.sparkling.method.registry.core.utils.createXModel
import com.tiktok.sparkling.methods.cimoc.cimoc.getvalue.AbsGetValueMethodIDL
import com.tiktok.sparkling.methods.cimoc.util.CimocNative
import java.io.File

class CimocGetValueMethod : AbsGetValueMethodIDL() {
    override fun handle(
        params: IDLMethodGetValueInputModel,
        callback: CompletionBlock<IDLMethodGetValueResultModel>,
        type: BridgePlatformType,
    ) {
        val context = getSDKContext()?.context
        if (context == null) {
            callback.onFailure(IDLBridgeMethod.FAIL, "Context not provided in host")
            return
        }
        val value =
            try {
                val file = File(CimocNative.storageDir(context), "${params.key}.json")
                if (file.exists()) file.readText() else ""
            } catch (e: Exception) {
                ""
            }
        callback.onSuccess(
            IDLMethodGetValueResultModel::class.java.createXModel().apply { this.value = value },
        )
    }
}
