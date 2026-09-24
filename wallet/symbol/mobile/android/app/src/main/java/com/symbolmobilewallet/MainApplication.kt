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
    // Set the night mode to always be on, so the system buttons match the app's dark theme.
    AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_YES)
    loadReactNative(this)
  }
}
