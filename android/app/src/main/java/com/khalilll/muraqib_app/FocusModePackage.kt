package com.khalilll.muraqib_app

import android.util.Log
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class FocusModePackage : ReactPackage {

    init {
        Log.d("FocusModePackage", "FocusModePackage instantiated")
    }

    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        Log.d("FocusModePackage", "createNativeModules called")
        return listOf(FocusModeModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}