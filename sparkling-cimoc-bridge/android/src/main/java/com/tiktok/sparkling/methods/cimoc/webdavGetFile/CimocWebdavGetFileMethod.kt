// cimoc.webdavGetFile — WebDAV GET 读取备份文件（Basic Auth，移植自旧 WebDavModule）。
package com.tiktok.sparkling.methods.cimoc.webdavGetFile

import android.util.Base64
import com.tiktok.sparkling.method.registry.core.BridgePlatformType
import com.tiktok.sparkling.method.registry.core.IDLBridgeMethod
import com.tiktok.sparkling.method.registry.core.model.idl.CompletionBlock
import com.tiktok.sparkling.method.registry.core.utils.createXModel
import com.tiktok.sparkling.methods.cimoc.cimoc.webdavgetfile.AbsWebdavGetFileMethodIDL
import com.tiktok.sparkling.methods.cimoc.util.CimocNative
import okhttp3.Request

class CimocWebdavGetFileMethod : AbsWebdavGetFileMethodIDL() {
    override fun handle(
        params: IDLMethodWebdavGetFileInputModel,
        callback: CompletionBlock<IDLMethodWebdavGetFileResultModel>,
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
                        .get()
                        .header("Authorization", auth)
                        .build()
                CimocNative.http().newCall(req).execute().use { resp ->
                    callback.onSuccess(
                        IDLMethodWebdavGetFileResultModel::class.java.createXModel().apply {
                            if (resp.isSuccessful) {
                                ok = true
                                content = resp.body?.string().orEmpty()
                            } else {
                                ok = false
                                status = resp.code
                            }
                        },
                    )
                }
            } catch (e: Exception) {
                callback.onSuccess(
                    IDLMethodWebdavGetFileResultModel::class.java.createXModel().apply {
                        ok = false
                        error = e.message ?: e.toString()
                    },
                )
            }
        }.start()
    }

    private fun baseUrl(base: String): String = if (base.endsWith("/")) base else "$base/"
}
