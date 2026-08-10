package com.cimoc.app

import com.lynx.jsbridge.Arguments
import com.lynx.jsbridge.LynxMethod
import com.lynx.jsbridge.LynxModule
import com.lynx.react.bridge.Callback
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

/**
 * WebDAV 备份桥：PUT/GET 收藏、标签、设置备份文件到 WebDAV 服务器。
 * 对应 Cimoc 的 WebDAV 云备份功能（webdav 后端）。
 */
class WebDavModule(context: android.content.Context) : LynxModule(context) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .build()

    private fun baseUrl(base: String): String =
        if (base.endsWith("/")) base else "$base/"

    @LynxMethod
    fun putFile(base: String, user: String, password: String, fileName: String, content: String, callback: Callback) {
        Thread {
            try {
                val url = baseUrl(base) + fileName
                val auth = "Basic " + android.util.Base64.encodeToString(
                    "$user:$password".toByteArray(), android.util.Base64.NO_WRAP
                )
                val body = content.toRequestBody()
                val req = Request.Builder()
                    .url(url)
                    .method("PUT", body)
                    .header("Authorization", auth)
                    .build()
                client.newCall(req).execute().use { resp ->
                    callback.invoke(resp.isSuccessful, resp.code)
                }
            } catch (e: Exception) {
                callback.invoke(false, e.message ?: e.toString())
            }
        }.start()
    }

    @LynxMethod
    fun getFile(base: String, user: String, password: String, fileName: String, callback: Callback) {
        Thread {
            try {
                val url = baseUrl(base) + fileName
                val auth = "Basic " + android.util.Base64.encodeToString(
                    "$user:$password".toByteArray(), android.util.Base64.NO_WRAP
                )
                val req = Request.Builder()
                    .url(url)
                    .get()
                    .header("Authorization", auth)
                    .build()
                client.newCall(req).execute().use { resp ->
                    if (resp.isSuccessful) {
                        val map = Arguments.createMap()
                        map.putBoolean("ok", true)
                        map.putString("content", resp.body?.string().orEmpty())
                        callback.invoke(map)
                    } else {
                        val map = Arguments.createMap()
                        map.putBoolean("ok", false)
                        map.putInt("status", resp.code)
                        callback.invoke(map)
                    }
                }
            } catch (e: Exception) {
                val map = Arguments.createMap()
                map.putBoolean("ok", false)
                map.putString("error", e.message ?: e.toString())
                callback.invoke(map)
            }
        }.start()
    }
}
