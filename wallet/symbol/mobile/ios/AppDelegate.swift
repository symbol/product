import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?
  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?
  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    self.launchOptions = launchOptions
    return true
  }

  func application(
    _ application: UIApplication,
    configurationForConnecting connectingSceneSession: UISceneSession,
    options: UIScene.ConnectionOptions
  ) -> UISceneConfiguration {
    let configuration = UISceneConfiguration(
      name: "Default Configuration",
      sessionRole: connectingSceneSession.role
    )
    configuration.delegateClass = SceneDelegate.self
    return configuration
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    addBrand(to: RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index"))
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }

#if DEBUG
  /// Adds the app brand to a Metro bundle URL.
  /// A file URL (prebuilt bundle, no Metro) is returned as is.
  private func addBrand(to url: URL?) -> URL? {
    guard let url, !url.isFileURL, var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
      return url
    }
    let brand = Bundle.main.object(forInfoDictionaryKey: "AppBrand") as? String
    components.queryItems = (components.queryItems ?? []) + [URLQueryItem(name: "resolver.brand", value: brand)]

    return components.url
  }
#endif
}
