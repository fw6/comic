package com.example.sparkling.go

import com.lynx.jsbridge.Arguments
import com.lynx.jsbridge.LynxMethod
import com.lynx.jsbridge.LynxModule
import com.lynx.react.bridge.Callback
import java.io.File

/**
 * 存储桥：将 JSON 字符串持久化到应用私有文件目录（收藏/历史/设置/下载/标签）。
 * Cimoc 用 SharedPreferences/文件保存数据；此处用 JSON 文件模拟持久层。
 */
class StorageModule(context: android.content.Context) : LynxModule(context) {

    @LynxMethod
    fun set(key: String, value: String, callback: Callback) {
        try {
            val dir = File(mContext.filesDir, "data")
            if (!dir.exists()) dir.mkdirs()
            val file = File(dir, "$key.json")
            file.writeText(value)
            callback.invoke(true)
        } catch (e: Exception) {
            callback.invoke(false, e.message ?: e.toString())
        }
    }

    @LynxMethod
    fun get(key: String, callback: Callback) {
        try {
            val file = File(File(mContext.filesDir, "data"), "$key.json")
            if (file.exists()) {
                callback.invoke(file.readText())
            } else {
                callback.invoke("")
            }
        } catch (e: Exception) {
            callback.invoke("")
        }
    }

    @LynxMethod
    fun remove(key: String, callback: Callback) {
        try {
            val file = File(File(mContext.filesDir, "data"), "$key.json")
            if (file.exists()) file.delete()
            callback.invoke(true)
        } catch (e: Exception) {
            callback.invoke(false)
        }
    }

    @LynxMethod
    fun list(callback: Callback) {
        val dir = File(mContext.filesDir, "data")
        val names = if (dir.exists()) dir.list()?.toList() ?: emptyList() else emptyList()
        val arr = Arguments.createArray()
        names.forEach { arr.pushString(it) }
        callback.invoke(arr)
    }
}
