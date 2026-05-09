package com.khalilll.muraqib_app

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.util.Log
import android.view.accessibility.AccessibilityEvent

class FocusModeService : AccessibilityService() {

    private var lastRedirectTime = 0L

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return

        val packageName = event.packageName?.toString() ?: return

        // Ignore our own app
        if (packageName == "com.khalilll.muraqib_app") return

        // Ignore system packages
        if (packageName.startsWith("com.android.systemui")) return
        if (packageName.startsWith("com.android.launcher")) return
        if (packageName.startsWith("com.google.android")) return
        if (packageName.startsWith("com.samsung.android")) return
        if (packageName.startsWith("com.miui")) return
        if (packageName == "android") return

        val prefs = getSharedPreferences("FocusMode", MODE_PRIVATE)
        val isActive = prefs.getBoolean("isActive", false)

        if (!isActive) return

        // Debounce — don't redirect more than once per 1.5 seconds
        val now = System.currentTimeMillis()
        if (now - lastRedirectTime < 1500) return
        lastRedirectTime = now

        Log.d("FocusModeService", "Redirecting from $packageName back to Muraqib")

        val intent = packageManager.getLaunchIntentForPackage("com.khalilll.muraqib_app")
        intent?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
        startActivity(intent)
    }

    override fun onInterrupt() {}
}