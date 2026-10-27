import Foundation
import Observation
import UserNotifications
#if os(iOS)
import UIKit
#else
import AppKit
#endif

/// Push notifications: kudos, friend requests and the evening reminder (sent by server/push.js).
/// After sign-in the app asks once for permission, then hands Apple's device token to the
/// server; tapping a notification opens the tab it's about.
@MainActor
@Observable
final class Push: NSObject {
    static let shared = Push()

    /// The tab a tapped notification asked for ("feed", "friends", "today"); the tab bar or
    /// sidebar switches to it and clears this.
    var openTab: String?
    @ObservationIgnored private var deviceToken: String?

    /// Xcode builds talk to Apple's sandbox push service; TestFlight and App Store builds to production.
    private var env: String {
        #if DEBUG
        "sandbox"
        #else
        "production"
        #endif
    }

    private var platform: String {
        #if os(iOS)
        "ios"
        #else
        "macos"
        #endif
    }

    func start() {
        UNUserNotificationCenter.current().delegate = self
    }

    /// Asks the first time (the system remembers the answer), and registers again on later
    /// launches, since Apple can change a device's token.
    func registerIfAllowed() async {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        switch settings.authorizationStatus {
        case .notDetermined:
            guard (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) == true else { return }
        case .denied:
            return
        default:
            break
        }
        #if os(iOS)
        UIApplication.shared.registerForRemoteNotifications()
        #else
        NSApplication.shared.registerForRemoteNotifications()
        #endif
    }

    func didRegister(_ token: Data) {
        let hex = token.map { String(format: "%02x", $0) }.joined()
        deviceToken = hex
        Task { try? await DailiesAPI.shared.registerPush(token: hex, platform: platform, env: env) }
    }

    /// Before signing out, so this device stops getting the account's notifications.
    func signOut(using stored: StoredToken) async {
        guard let deviceToken else { return }
        await DailiesAPI.shared.unregisterPush(token: deviceToken, using: stored)
        clearBadge()
    }

    func clearBadge() {
        UNUserNotificationCenter.current().setBadgeCount(0)
    }
}

extension Push: UNUserNotificationCenterDelegate {
    // shown while the app is open, too; a kudos also refreshes the Feed's badge
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter, willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        await FeedModel.shared.refreshUnseen()
        return [.banner, .list, .sound]
    }

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        let tab = response.notification.request.content.userInfo["tab"] as? String
        await MainActor.run { Push.shared.openTab = tab }
    }
}

#if os(iOS)
final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        Push.shared.start() // before launch finishes, so a tap that launched the app isn't missed
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Push.shared.didRegister(deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        log.error("push registration failed: \(error.localizedDescription, privacy: .public)")
    }
}
#else
final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationWillFinishLaunching(_ notification: Notification) {
        Push.shared.start()
    }

    func application(_ application: NSApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Push.shared.didRegister(deviceToken)
    }

    func application(_ application: NSApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        log.error("push registration failed: \(error.localizedDescription, privacy: .public)")
    }
}
#endif
