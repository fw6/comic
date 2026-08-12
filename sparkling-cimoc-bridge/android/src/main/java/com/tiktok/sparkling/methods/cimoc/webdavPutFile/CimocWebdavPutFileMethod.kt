// cimoc.webdavPutFile — WebDAV PUT 备份文件（Basic Auth，移植自旧 WebDavModule）。
package com.tiktok.sparkling.methods.cimoc.webdavPutFile

import android.util.Base64
import com.tiktok.sparkling.method.registry.core.BridgePlatformType
import com.tiktok.sparkling.method.registry.core.IDLBridgeMethod
import com.tiktok.sparkling.method.registry.core.model.idl.CompletionBlock
import com.tiktok.sparkling.method.registry.core.utils.createXModel
import com.tiktok.sparkling.methods.cimoc.cimoc.webdavputfile.AbsWebdavPutFileMethodIDL
import com.tiktok.sparkling.methods.cimoc.util.CimocNative
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

class CimocWebdavPutFileMethod : AbsWebdavPutFileMethodIDL() {
    override fun handle(
        params: IDLMethodWebdavPutFileInputModel,
        callback: CompletionBlock<IDLMethodWebdavPutFileResultModel>,
        type: BridgePlatformType,
    ) {
        if (getSDKContext()?.context == null) {
            callback.onFailure(IDLBridgeMethod.FAIL, "Context not provided in host")
            return
        }
        Thread {
            try {
                val url = baseUrl(params.base) + params.fileName
                val auth =
                    "Basic " + Base64.encodeToString(
                        "${params.user}:${params.password}".toByteArray(),
                        Base64.NO_WRAP,
                    )
                val req =
                    Request.Builder()
                        .url(url)
                        .method("PUT", params.content.toRequestBody())
                        .header("Authorization", auth)
                        .build()
                CimocNative.http().newCall(req).execute().use { resp ->
                    callback.onSuccess(
                        IDLMethodWebdavPutFileResultModel::class.java.createXModel().apply {
                            success = resp.isSuccessful
                            status = resp.code
                        },
                    )
                }
            } catch (e: Exception) {
                callback.onFailure(IDLBridgeMethod.FAIL, e.message ?: e.toString())
            }
        }.start()
    }

    private fun baseUrl(base: String): String = if (base.endsWith("/")) base else "$base/"
}
