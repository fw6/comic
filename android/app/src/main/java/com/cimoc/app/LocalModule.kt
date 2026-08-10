package com.cimoc.app

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import com.lynx.jsbridge.Arguments
import com.lynx.jsbridge.LynxMethod
import com.lynx.jsbridge.LynxModule
import com.lynx.react.bridge.Callback
import java.io.File

/**
 * 本地桥：SAF 文件夹选择 + 扫描本地漫画文件（Cimoc 本地导入功能）。
 * 通过宿主 MainActivity 转发 SAF 结果；此处提供列出应用目录下漫画文件的能力。
 */
class LocalModule(context: android.content.Context) : LynxModule(context) {

    private fun localBase(): File {
        val dir = File(mContext.getExternalFilesDir(null), "download")
        if (!dir.exists()) dir.mkdirs()
        return dir
    }

    /** 扫描本地已下载的漫画列表，返回 [{comicId, chapterCount}] */
    @LynxMethod
    fun scanLocalComics(callback: Callback) {
        val base = localBase()
        val arr = Arguments.createArray()
        base.listFiles()?.forEach { comicDir ->
            if (comicDir.isDirectory) {
                val map = Arguments.createMap()
                map.putString("comicId", comicDir.name)
                map.putInt("chapterCount", comicDir.listFiles()?.size ?: 0)
                arr.pushMap(map)
            }
        }
        callback.invoke(arr)
    }

    /** 列出某漫画的本地章节，返回 [{chapterIndex, pageCount, dir}] */
    @LynxMethod
    fun listLocalChapters(comicId: String, callback: Callback) {
        val comicDir = File(localBase(), comicId)
        val arr = Arguments.createArray()
        comicDir.listFiles()?.forEach { chapterDir ->
            if (chapterDir.isDirectory) {
                val idx = chapterDir.name.removePrefix("chapter_").toIntOrNull() ?: return@forEach
                val pageCount = chapterDir.listFiles()?.size ?: 0
                val map = Arguments.createMap()
                map.putInt("chapterIndex", idx)
                map.putInt("pageCount", pageCount)
                map.putString("dir", chapterDir.absolutePath)
                arr.pushMap(map)
            }
        }
        callback.invoke(arr)
    }

    /** 发起 SAF 文件夹选择（由宿主 Activity 处理 onActivityResult） */
    @LynxMethod
    fun pickFolder(callback: Callback) {
        val ctx = mContext
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE)
        try {
            if (ctx is Activity) {
                ctx.startActivityForResult(intent, MainActivity.REQ_PICK_FOLDER)
                callback.invoke(true, "picker started")
            } else {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                ctx.startActivity(intent)
                callback.invoke(true, "picker started (new task)")
            }
        } catch (e: Exception) {
            callback.invoke(false, e.message ?: e.toString())
        }
    }
}
