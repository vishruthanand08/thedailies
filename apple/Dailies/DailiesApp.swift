import SwiftUI

@main
struct DailiesApp: App {
    var body: some Scene {
        #if os(iOS)
        WindowGroup {
            RootView()
        }
        #else
        // one main window: the shared web view can only live in one view hierarchy
        Window("The Dailies", id: "main") {
            RootView()
        }
        .defaultSize(width: 480, height: 860)
        .commands {
            CommandGroup(after: .toolbar) {
                Button("Reload") { WebController.shared.reload() }
                    .keyboardShortcut("r", modifiers: .command)
                #if DEBUG
                Menu("Switch Server") {
                    ForEach(Server.allCases) { server in
                        Button(server.label) {
                            Server.current = server
                            WebController.shared.load()
                        }
                    }
                }
                #endif
            }
        }
        #endif
    }
}
