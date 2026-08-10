package com.cimoc.app

import com.lynx.jsbridge.Arguments
import com.lynx.jsbridge.CallbackImpl
import com.lynx.jsbridge.LynxMethod
import com.lynx.jsbridge.LynxModule
import com.lynx.react.bridge.Callback
import com.lynx.react.bridge.ReadableMap
import com.lynx.react.bridge.WritableMap
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

/**
 * 网络桥：提供 HTTP GET（返回文本/JSON）能力，供 JS 图源解析器使用。
 * 基于宿主已有的 okhttp。
 */
class NetworkModule(context: android.content.Context) : LynxModule(context) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .followRedirects(true)
        .followSslRedirects(true)
        .build()

    private val UA =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"

    @LynxMethod
    fun getText(url: String, headers: ReadableMap?, callback: Callback) {
        Thread {
            try {
                val builder = Request.Builder().url(url).header("User-Agent", UA)
                headers?.let { map ->
                    val iter = map.keySetIterator()
                    while (iter.hasNextKey()) {
                        val k = iter.nextKey()
                        builder.header(k, map.getString(k))
                    }
                }
                client.newCall(builder.build()).execute().use { resp ->
                    val body = resp.body?.string().orEmpty()
                    val map = Arguments.createMap()
                    map.putInt("status", resp.code)
                    map.putString("body", body)
                    callback.invoke(map)
                }
            } catch (e: Exception) {
                val map = Arguments.createMap()
                map.putInt("status", 0)
                map.putString("error", e.message ?: e.toString())
                callback.invoke(map)
            }
        }.start()
    }

    @LynxMethod
    fun getBytes(url: String, callback: Callback) {
        Thread {
            try {
                val builder = Request.Builder().url(url).header("User-Agent", UA)
                client.newCall(builder.build()).execute().use { resp ->
                    val bytes = resp.body?.bytes() ?: ByteArray(0)
                    val map = Arguments.createMap()
                    map.putInt("status", resp.code)
                    map.putString("base64", android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP))
                    callback.invoke(map)
                }
            } catch (e: Exception) {
                val map = Arguments.createMap()
                map.putInt("status", 0)
                map.putString("error", e.message ?: e.toString())
                callback.invoke(map)
            }
        }.start()
    }

    @LynxMethod
    fun isNetworkAvailable(callback: Callback) {
        val cm = mContext.getSystemService(android.content.Context.CONNECTIVITY_SERVICE)
                as? android.net.ConnectivityManager
        val active = cm?.activeNetwork
        callback.invoke(active != null)
    }
}
