// cimoc.getText — HTTP GET 抓取（移植自旧 NetworkModule）。
package com.tiktok.sparkling.methods.cimoc.getText

import com.tiktok.sparkling.method.registry.core.BridgePlatformType
import com.tiktok.sparkling.method.registry.core.IDLBridgeMethod
import com.tiktok.sparkling.method.registry.core.model.idl.CompletionBlock
import com.tiktok.sparkling.method.registry.core.utils.createXModel
import com.tiktok.sparkling.methods.cimoc.cimoc.gettext.AbsGetTextMethodIDL
import com.tiktok.sparkling.methods.cimoc.util.CimocNative
import okhttp3.Request

class CimocGetTextMethod : AbsGetTextMethodIDL() {
    override fun handle(
        params: IDLMethodGetTextInputModel,
        callback: CompletionBlock<IDLMethodGetTextResultModel>,
        type: BridgePlatformType,
    ) {
        if (getSDKContext()?.context == null) {
            callback.onFailure(IDLBridgeMethod.FAIL, "Context not provided in host")
            return
        }
        Thread {
            try {
                val builder = Request.Builder().url(params.url).header("User-Agent", CimocNative.UA)
                for ((k, v) in CimocNative.parseHeaders(params.headers)) {
                    builder.header(k, v)
                }
                CimocNative.http().newCall(builder.build()).execute().use { resp ->
                    callback.onSuccess(
                        IDLMethodGetTextResultModel::class.java.createXModel().apply {
                            status = resp.code
                            body = resp.body?.string().orEmpty()
                        },
                    )
                }
            } catch (e: Exception) {
                callback.onFailure(IDLBridgeMethod.FAIL, e.message ?: e.toString())
            }
        }.start()
    }
}
