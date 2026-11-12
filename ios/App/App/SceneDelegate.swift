import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = MainViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

/// Hlavní obrazovka hry – registruje vlastní pluginy aplikace.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(AppExitPlugin())
    }
}

/// Tlačítko „Už stačilo“: pošle aplikaci na plochu, stejně jako gesto domů.
/// Pozor: Apple v pravidlech (HIG) nedoporučuje, aby se aplikace zavírala sama;
/// kdyby to při schvalování vadilo, stačí v src/main.js ve funkci quit()
/// nechat jen rozloučení a tento plugin nevolat.
@objc(AppExitPlugin)
public class AppExitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppExitPlugin"
    public let jsName = "AppExit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "exit", returnType: CAPPluginReturnPromise)
    ]

    @objc func exit(_ call: CAPPluginCall) {
        call.resolve()
        DispatchQueue.main.async {
            UIControl().sendAction(#selector(URLSessionTask.suspend), to: UIApplication.shared, for: nil)
        }
    }
}
