package com.tiktok.sparkling.methods.cimoc.back

import android.app.Activity
import android.app.Application
import android.content.Context
import android.os.Build
import android.os.Bundle
import android.view.KeyEvent
import android.widget.Toast
import com.tiktok.sparkling.method.registry.core.IBridgeContext
import org.json.JSONObject

/**
 * 系统返回拦截：把 Android 系统返回（手势/实体键）接到 JS 导航栈。
 *
 * JS 通过 cimoc.setBackState 上报「当前栈是否可返回」：
 * - 可返回 → sendEvent("cimocBack") 通知 JS nav.pop()，宿主不退出；
 * - 不可返回（根页）→ 复刻框架的「再按一次退出」。
 *
 * 通道说明（已验证）：宿主 SparklingActivity.onBackPressed 是固定的连按两次退出且
 * 类为 final 无法继承，因此改用：
 * - API 33+（需 manifest enableOnBackInvokedCallback=true）：window 的
 *   OnBackInvokedDispatcher 高优先级回调，接管手势返回；
 * - API < 33：DecorView OnKeyListener 拦截 KEYCODE_BACK。
 * 两路径都先于框架 onBackPressed 执行，且同一设备只会命中其一。
 */
object CimocBackInterceptor {

    private const val EVENT_BACK = "cimocBack"
    private const val EXIT_INTERVAL_MS = 2000L

    @Volatile
    var canGoBack: Boolean = false
        private set

    private var jsEvent: IBridgeContext? = null
    private var installed = false
    private var lastBackPress = 0L

    fun setCanGoBack(value: Boolean) {
        canGoBack = value
    }

    /** 幂等安装：注册 ActivityLifecycleCallbacks，为每个 SparklingActivity 挂返回拦截。 */
    fun install(context: Context?, bridge: IBridgeContext) {
        jsEvent = bridge
        if (installed) return
        installed = true
        val app = context?.applicationContext as? Application ?: return
        app.registerActivityLifecycleCallbacks(
            object : Application.ActivityLifecycleCallbacks {
                override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        setupOnBackInvoked(activity)
                    } else {
                        setupKeyListener(activity)
                    }
                }

                override fun onActivityStarted(activity: Activity) {}
                override fun onActivityResumed(activity: Activity) {}
                override fun onActivityPaused(activity: Activity) {}
                override fun onActivityStopped(activity: Activity) {}
                override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
                override fun onActivityDestroyed(activity: Activity) {}
            },
        )
    }

    /** API 33+：预测性返回（手势/实体键）走 OnBackInvokedDispatcher，最高优先级接管。 */
    @Suppress("NewApi")
    private fun setupOnBackInvoked(activity: Activity) {
        activity.window.onBackInvokedDispatcher.registerOnBackInvokedCallback(
            Int.MAX_VALUE,
            android.window.OnBackInvokedCallback { handleBack(activity) },
        )
    }

    /** API < 33：3 键导航的返回键走 KeyEvent，在 DecorView 层拦截。 */
    private fun setupKeyListener(activity: Activity) {
        activity.window.decorView.setOnKeyListener { _, keyCode, event ->
            if (keyCode == KeyEvent.KEYCODE_BACK && event.action == KeyEvent.ACTION_DOWN) {
                handleBack(activity)
                true
            } else {
                false
            }
        }
    }

    private fun handleBack(activity: Activity) {
        if (canGoBack && jsEvent != null) {
            jsEvent?.sendEvent(EVENT_BACK, JSONObject().put("canGoBack", true))
            return
        }
        // 根页：连按两次退出（对齐框架原行为）
        val now = System.currentTimeMillis()
        if (now - lastBackPress < EXIT_INTERVAL_MS) {
            activity.finish()
        } else {
            lastBackPress = now
            Toast.makeText(activity, "再按一次退出", Toast.LENGTH_SHORT).show()
        }
    }
}
