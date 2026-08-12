// cimoc.getBytes — HTTP GET 下载二进制（base64 返回，移植自旧 NetworkModule）。
package com.tiktok.sparkling.methods.cimoc.getBytes

import android.util.Base64
import com.tiktok.sparkling.method.registry.core.BridgePlatformType
import com.tiktok.sparkling.method.registry.core.IDLBridgeMethod
import com.tiktok.sparkling.method.registry.core.model.idl.CompletionBlock
import com.tiktok.sparkling.method.registry.core.utils.createXModel
import com.tiktok.sparkling.methods.cimoc.cimoc.getbytes.AbsGetBytesMethodIDL
import com.tiktok.sparkling.methods.cimoc.util.CimocNative
import okhttp3.Request

class CimocGetBytesMethod : AbsGetBytesMethodIDL() {
    override fun handle(
        params: IDLMethodGetBytesInputModel,
        callback: CompletionBlock<IDLMethodGetBytesResultModel>,
        type: BridgePlatformType,
    ) {
        if (getSDKContext()?.context == null) {
            callback.onFailure(IDLBridgeMethod.FAIL, "Context not provided in host")
            return
        }
        Thread {
            try {
                val builder = Request.Builder().url(params.url).header("User-Agent", CimocNative.UA)
                CimocNative.http().newCall(builder.build()).execute().use { resp ->
                    val bytes = resp.body?.bytes() ?: ByteArray(0)
                    callback.onSuccess(
                        IDLMethodGetBytesResultModel::class.java.createXModel().apply {
                            status = resp.code
                            base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
                        },
                    )
                }
            } catch (e: Exception) {
                callback.onFailure(IDLBridgeMethod.FAIL, e.message ?: e.toString())
            }
        }.start()
    }
}
