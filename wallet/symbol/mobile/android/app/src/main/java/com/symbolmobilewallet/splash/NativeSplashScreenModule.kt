package com.thesymbolsyndicate.symbolwallet.splash

import android.app.Activity
import android.app.Dialog
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil
import com.thesymbolsyndicate.symbolwallet.R
import com.thesymbolsyndicate.symbolwallet.specs.NativeSplashScreenSpec

/**
 * Shows the splash image in a dialog window over the activity until the JS side calls hide(),
 * mirroring the react-native-splash-screen approach (fade-out on dismiss via the dialog theme).
 */
class NativeSplashScreenModule(reactContext: ReactApplicationContext) : NativeSplashScreenSpec(reactContext) {

  override fun getName() = NAME

  override fun hide() {
    UiThreadUtil.runOnUiThread {
      val dialog = splashDialog ?: return@runOnUiThread
      splashDialog = null
      val activity = dialog.ownerActivity ?: return@runOnUiThread
      if (activity.isFinishing || activity.isDestroyed || !dialog.isShowing) return@runOnUiThread

      dialog.dismiss()
    }
  }

  companion object {
    const val NAME = "NativeSplashScreen"

    private var splashDialog: Dialog? = null

    /**
     * Shows the launch screen layout in a full-screen dialog on top of the activity.
     */
    fun show(activity: Activity) {
      if (activity.isFinishing) return

      val dialog = Dialog(activity, R.style.SplashScreenTheme)
      dialog.setContentView(R.layout.launch_screen)
      dialog.setCancelable(false)
      dialog.setOwnerActivity(activity)
      dialog.show()
      splashDialog = dialog
    }
  }
}
