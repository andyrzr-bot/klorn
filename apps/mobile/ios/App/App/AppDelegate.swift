import UIKit
import Capacitor
import UserNotifications

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        KlornNotificationCategories.register()
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    // --- Native push (APNs) ---
    // @capacitor/push-notifications needs these forwarded so the plugin receives
    // the APNs device token (the 'registration' event). Without them iOS push
    // silently never registers. The token is a raw APNs token (not FCM) — the
    // backend delivers to it via APNs directly (packages/api/src/push-apns.ts).
    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        NotificationCenter.default.post(
            name: .capacitorDidRegisterForRemoteNotifications,
            object: deviceToken
        )
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        NotificationCenter.default.post(
            name: .capacitorDidFailToRegisterForRemoteNotifications,
            object: error
        )
    }

}

// --- Notification actions (long-press a Klorn notification) ---
// The server picks a category with `aps.category` (see apps/mobile/README.md
// "Push payload"). The app's JS handles each action id (src/push/route.ts):
//   KLORN_SEND  — "Send draft": requires the device to be unlocked AND opens
//                 the app on the approval card, where sending is one more
//                 explicit tap. Nothing is ever sent from the lock screen.
//   KLORN_LATER — "In 1 hour": snoozes the attention item (no UI).
//   KLORN_DONE  — "Done": marks the attention item done (no UI).
enum KlornNotificationCategories {
    static let pushWithDraft = "KLORN_PUSH_DRAFT"
    static let push = "KLORN_PUSH"

    static func register() {
        let t = titles()
        let send = UNNotificationAction(
            identifier: "KLORN_SEND",
            title: t.send,
            options: [.authenticationRequired, .foreground]
        )
        let later = UNNotificationAction(identifier: "KLORN_LATER", title: t.later, options: [])
        let done = UNNotificationAction(identifier: "KLORN_DONE", title: t.done, options: [])
        let withDraft = UNNotificationCategory(
            identifier: pushWithDraft,
            actions: [send, later, done],
            intentIdentifiers: [],
            options: []
        )
        let plain = UNNotificationCategory(
            identifier: push,
            actions: [later, done],
            intentIdentifiers: [],
            options: []
        )
        UNUserNotificationCenter.current().setNotificationCategories([withDraft, plain])
    }

    /// The action titles in the device's language (the app's 7 languages, English otherwise).
    private static func titles() -> (send: String, later: String, done: String) {
        let lang = Locale.preferredLanguages.first.map { String($0.prefix(2)) } ?? "en"
        switch lang {
        case "ko": return ("초안 보내기", "1시간 뒤에", "처리 완료")
        case "ja": return ("下書きを送信", "1時間後に", "処理済み")
        case "zh": return ("发送草稿", "1 小时后", "已处理")
        case "es": return ("Enviar borrador", "En 1 hora", "Hecho")
        case "fr": return ("Envoyer le brouillon", "Dans 1 heure", "Traité")
        case "de": return ("Entwurf senden", "In 1 Stunde", "Erledigt")
        default: return ("Send draft", "In 1 hour", "Done")
        }
    }
}
