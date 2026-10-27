#if DEBUG
import SwiftUI
import WebKit

/// Debug-only tools: server switch and a test submission.
struct DebugMenu: View {
    @Environment(\.dismiss) private var dismiss
    @State private var server = Server.current

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
                Section("Test") {
                    Button("Submit today's Wordle (3/6)") {
                        SubmissionQueue.shared.enqueue(DebugSamples.wordleToday())
                        dismiss()
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
@MainActor
enum DebugHooks {
    private static var evalDone = false

    static func pageLoaded(_ webView: WKWebView) {
        guard !evalDone, let js = UserDefaults.standard.string(forKey: "dailiesEval") else { return }
        evalDone = true
        log.info("debug: running -dailiesEval")
        webView.evaluateJavaScript(js)
    }

    static func start() {
        guard UserDefaults.standard.bool(forKey: "dailiesTestWordle") else { return }
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
