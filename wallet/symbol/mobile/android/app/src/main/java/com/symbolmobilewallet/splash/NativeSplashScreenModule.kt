package com.thesymbolsyndicate.symbolwallet.splash

import android.app.Activity
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil
import com.thesymbolsyndicate.symbolwallet.R
import com.thesymbolsyndicate.symbolwallet.specs.NativeSplashScreenSpec

/**
 * Shows the full-screen splash image over the activity content until the JS side calls hide().
 */
class NativeSplashScreenModule(reactContext: ReactApplicationContext) : NativeSplashScreenSpec(reactContext) {

  override fun getName() = NAME

  override fun hide() {
    UiThreadUtil.runOnUiThread {
      splashView?.let { view -> (view.parent as? ViewGroup)?.removeView(view) }
      splashView = null
    }
  }

  companion object {
    const val NAME = "NativeSplashScreen"

    private var splashView: View? = null

    /**
     * Inflates the launch screen layout on top of the activity's decor view.
     */
    fun show(activity: Activity) {
      val decorView = activity.window.decorView as ViewGroup
      val view = LayoutInflater.from(activity).inflate(R.layout.launch_screen, decorView, false)
      decorView.addView(view)
      splashView = view
    }
  }
}
