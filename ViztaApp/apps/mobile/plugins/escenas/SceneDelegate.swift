import UIKit
import React

/**
 * La ventana de Vizta, manejada como escena.
 *
 * iOS 27 no abre una app compilada con su SDK si no usa escenas: la cierra al
 * arrancar. Con escenas, el AppDelegate arranca la app y cada ventana la crea
 * su escena. En el iPhone sigue habiendo una sola.
 *
 * El AppDelegate sigue siendo el centro: Expo reparte desde ahí los avisos a sus
 * módulos (notificaciones, enlaces, actualizaciones). Por eso esta escena no
 * hace nada por su cuenta: crea la ventana y le reenvía al AppDelegate lo que
 * ahora le llega a ella —enlaces, universal links, activar y pasar a segundo
 * plano—, para que ningún módulo deje de enterarse.
 *
 * Lo genera el plugin `plugins/escenas`; editarlo acá se pierde con el
 * próximo `expo prebuild`.
 */
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  private var appDelegate: AppDelegate? {
    UIApplication.shared.delegate as? AppDelegate
  }

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene, let appDelegate else { return }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    // Varios módulos buscan la ventana en `UIApplication.shared.delegate.window`
    // (expo-system-ui, RCTDeviceInfo, expo-updates): tiene que seguir ahí.
    appDelegate.window = window

    // Con escenas, el enlace con el que se abrió la app llega a la escena y no
    // a las opciones de arranque. React Native lo lee de ahí (`getInitialURL`),
    // así que se lo devuelve a ese lugar.
    var launchOptions = appDelegate.opcionesDeArranque ?? [:]
    if let url = connectionOptions.urlContexts.first?.url {
      launchOptions[.url] = url
    }
    if let actividad = connectionOptions.userActivities.first(where: { $0.activityType == NSUserActivityTypeBrowsingWeb }) {
      launchOptions[.userActivityDictionary] = [
        "UIApplicationLaunchOptionsUserActivityKey": actividad,
        UIApplication.LaunchOptionsKey.userActivityType: actividad.activityType,
      ]
    }

    appDelegate.reactNativeFactory?.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions
    )
  }

  // MARK: - Enlaces con la app ya abierta

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let appDelegate else { return }
    for contexto in URLContexts {
      var opciones: [UIApplication.OpenURLOptionsKey: Any] = [:]
      if let origen = contexto.options.sourceApplication { opciones[.sourceApplication] = origen }
      if let anotacion = contexto.options.annotation { opciones[.annotation] = anotacion }
      opciones[.openInPlace] = contexto.options.openInPlace
      _ = appDelegate.application(UIApplication.shared, open: contexto.url, options: opciones)
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = appDelegate?.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
  }

  // MARK: - Ciclo de vida
  //
  // Con escenas, UIKit ya no le avisa al AppDelegate cuando la app se activa o
  // pasa a segundo plano: le avisa a la escena. Se reenvía para que Expo lo siga
  // repartiendo a sus módulos.

  func sceneDidBecomeActive(_ scene: UIScene) {
    appDelegate?.applicationDidBecomeActive(UIApplication.shared)
  }

  func sceneWillResignActive(_ scene: UIScene) {
    appDelegate?.applicationWillResignActive(UIApplication.shared)
  }

  func sceneWillEnterForeground(_ scene: UIScene) {
    appDelegate?.applicationWillEnterForeground(UIApplication.shared)
  }

  func sceneDidEnterBackground(_ scene: UIScene) {
    appDelegate?.applicationDidEnterBackground(UIApplication.shared)
  }
}
