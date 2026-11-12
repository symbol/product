package com.thesymbolsyndicate.symbolwallet

import android.app.Application
import androidx.appcompat.app.AppCompatDelegate
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.thesymbolsyndicate.symbolwallet.splash.NativeSplashScreenPackage

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
          add(NativeSplashScreenPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    // Match the night mode to the brand theme, so the system bar buttons match the app.
    val isLightTheme = resources.getBoolean(R.bool.is_light_theme)
    val nightMode = if (isLightTheme) AppCompatDelegate.MODE_NIGHT_NO else AppCompatDelegate.MODE_NIGHT_YES
    AppCompatDelegate.setDefaultNightMode(nightMode)
    loadReactNative(this)
    // Add the app brand to Metro bundle URLs.
    reactHost.devSupportManager?.setAdditionalOptionForPackager("resolver.brand", BuildConfig.FLAVOR)
  }
}
