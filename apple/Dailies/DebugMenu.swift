#if DEBUG
import SwiftUI
import WebKit

/// Debug-only tools: server switch and a test submission.
struct DebugMenu: View {
    @Environment(\.dismiss) private var dismiss
    @State private var server = Server.current
    @State private var inApp = GameHosts.inAppEnabled
    @State private var experimental = GameHosts.experimentalEnabled

    var body: some View {
        NavigationStack {
            Form {
                Section("Server") {
                    Picker("Server", selection: $server) {
                        ForEach(Server.allCases) { Text($0.label).tag($0) }
                    }
                    .pickerStyle(.inline)
                    .labelsHidden()
                    .onChange(of: server) { _, new in
                        Server.current = new
                        WebController.shared.load()
                    }
                }
                Section("Device token") {
                    if let t = Keychain.load() {
                        LabeledContent("Signed in as", value: t.username)
                        LabeledContent("Server", value: t.server)
                    } else {
                        Text("No token in the keychain yet")
                    }
                }
                Section {
                    Toggle("Play games in the app", isOn: $inApp)
                        .onChange(of: inApp) { _, on in
                            GameHosts.inAppEnabled = on
                            WebController.shared.refreshNativeFlags()
                        }
                    Toggle("Experimental: NYT and LinkedIn in-app (personal use only)", isOn: $experimental)
                        .disabled(!inApp)
                        .onChange(of: experimental) { _, on in GameHosts.experimentalEnabled = on }
                } header: {
                    Text("In-app game browser")
                } footer: {
                    Text("Play opens allowlisted games inside the app and saves the score when you tap the game's Share button. Everything else opens in Safari.")
                }
                Section("Test") {
                    Button("Submit today's Wordle (3/6)") {
                        SubmissionQueue.shared.enqueue(DebugSamples.wordleToday())
                        dismiss()
                    }
                    Button("Open capture harness") {
                        dismiss()
                        DebugHooks.openHarness()
                    }
                }
            }
            .navigationTitle("Debug")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
        #if os(macOS)
        .frame(minWidth: 380, minHeight: 420)
        #endif
    }
}

/// Launch arguments for driving the Simulator from the command line (Debug builds only):
///   -dailiesServer local        use the local dev server
///   -dailiesEval "<js>"         run once in the main web view after the first page load
///   -dailiesTestWordle YES      submit today's Wordle once a device token is in the keychain
///   -dailiesInAppGames NO       turn off the in-app game browser (on by default; -dailiesExperimentalGames NO for NYT/LinkedIn)
///   -dailiesOpenGame <url>      open that game through the normal Play routing after launch
///   -dailiesOpenHarness YES     open the bundled capture harness after launch
///   -dailiesGameEval "<js>"     run once in the game browser after its first page load
@MainActor
enum DebugHooks {
    private static var evalDone = false

    static func openHarness() {
        guard let url = Bundle.main.url(forResource: "harness", withExtension: "html") else {
            log.error("harness.html missing from the bundle")
            return
        }
        // let the debug sheet finish dismissing before presenting another
        Task {
            try? await Task.sleep(for: .milliseconds(600))
            WebController.shared.presentGame?(GameLaunch(url: url, name: "Capture harness", harness: true))
        }
    }

    static func pageLoaded(_ webView: WKWebView) {
        guard !evalDone, let js = UserDefaults.standard.string(forKey: "dailiesEval") else { return }
        evalDone = true
        log.info("debug: running -dailiesEval")
        webView.evaluateJavaScript(js)
    }

    static func start() {
        let args = UserDefaults.standard
        if args.bool(forKey: "dailiesOpenHarness") {
            openHarness()
        } else if let s = args.string(forKey: "dailiesOpenGame"), let url = URL(string: s) {
            Task {
                try? await Task.sleep(for: .milliseconds(600))
                WebController.shared.open(url, name: url.host ?? "Game")
            }
        }
        guard args.bool(forKey: "dailiesTestWordle") else { return }
        Task {
            for _ in 0..<40 where Keychain.load() == nil {
                try? await Task.sleep(for: .milliseconds(500))
            }
            log.info("debug: enqueueing today's Wordle")
            SubmissionQueue.shared.enqueue(DebugSamples.wordleToday())
        }
    }
}

enum DebugSamples {
    /// A Wordle share for today's puzzle (#0 was 2021-06-19; days roll over on US Eastern time).
    static func wordleToday() -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "America/New_York")!
        let epoch = cal.date(from: DateComponents(year: 2021, month: 6, day: 19))!
        let n = cal.dateComponents([.day], from: epoch, to: cal.startOfDay(for: Date())).day ?? 0
        let number = n.formatted(.number.grouping(.automatic).locale(Locale(identifier: "en_US")))
        return "Wordle \(number) 3/6\n\n⬛🟨⬛⬛⬛\n🟨🟩⬛⬛🟩\n🟩🟩🟩🟩🟩"
    }
}
#endif
