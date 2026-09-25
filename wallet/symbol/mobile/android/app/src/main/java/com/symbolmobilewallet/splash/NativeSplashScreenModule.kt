package com.thesymbolsyndicate.symbolwallet.splash

import android.app.Activity
import android.app.Dialog
import androidx.annotation.UiThread
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil
import com.thesymbolsyndicate.symbolwallet.R
import com.thesymbolsyndicate.symbolwallet.specs.NativeSplashScreenSpec
import java.lang.ref.WeakReference

/**
 * Shows the splash image in a dialog window over the activity until the JS side calls hide().
 */
class NativeSplashScreenModule(reactContext: ReactApplicationContext) : NativeSplashScreenSpec(reactContext) {

  override fun getName() = NAME

  override fun hide() {
    UiThreadUtil.runOnUiThread { dismiss() }
  }

  /**
   * Dismisses the splash when the React instance is torn down, so the dialog cannot outlive
   * the app content it covers.
   */
  override fun invalidate() {
    hide()
    super.invalidate()
  }

  companion object {
    const val NAME = "NativeSplashScreen"

    private var splashDialog: WeakReference<Dialog>? = null

    /**
     * Shows the launch screen layout in a full-screen dialog on top of the activity.
     */
    @UiThread
    fun show(activity: Activity) {
      if (activity.isFinishing || activity.isDestroyed) return

      dismiss()
      splashDialog = WeakReference(
        Dialog(activity, R.style.SplashScreenTheme).apply {
          setContentView(R.layout.launch_screen)
          setCancelable(false)
          setOwnerActivity(activity)
          show()
        }
      )
    }

    /**
     * Dismisses the current splash dialog if its activity is still alive.
     */
    @UiThread
    private fun dismiss() {
      val dialog = splashDialog?.get()
      splashDialog = null

      if (dialog == null) return

      val activity = dialog.ownerActivity ?: return
      
      if (activity.isFinishing || activity.isDestroyed || !dialog.isShowing) return

      dialog.dismiss()
    }
  }
}
