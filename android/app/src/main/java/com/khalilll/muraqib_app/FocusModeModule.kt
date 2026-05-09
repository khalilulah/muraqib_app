package com.khalilll.muraqib_app

import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.text.TextUtils
import android.util.Log
import com.facebook.react.bridge.*

class FocusModeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    init {
        Log.d("FocusModeModule", "FocusModeModule instantiated")
    }

    override fun getName() = "FocusMode"

    @ReactMethod
    fun setActive(active: Boolean) {
        val prefs = reactApplicationContext
            .getSharedPreferences("FocusMode", Context.MODE_PRIVATE)
        prefs.edit().putBoolean("isActive", active).apply()
    }

    @ReactMethod
    fun isAccessibilityEnabled(promise: Promise) {
        promise.resolve(isServiceEnabled())
    }

    @ReactMethod
    fun openAccessibilitySettings() {
        val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactApplicationContext.startActivity(intent)
    }

    private fun isServiceEnabled(): Boolean {
        // 👇 .name instead of .canonicalName
        val service = "${reactApplicationContext.packageName}/${FocusModeService::class.java.name}"
        val enabledServices = Settings.Secure.getString(
            reactApplicationContext.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: return false
        return TextUtils.SimpleStringSplitter(':').also {
            it.setString(enabledServices)
        }.asSequence().any { it.equals(service, ignoreCase = true) }
    }
}