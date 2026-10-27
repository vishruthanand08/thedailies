import SwiftUI

struct RootView: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var queue = SubmissionQueue.shared
    #if os(iOS)
    @State private var game: GameLaunch?
    #else
    @Environment(\.openWindow) private var openWindow
    #endif
    #if DEBUG
    @State private var showDebug = false
    #endif

    var body: some View {
        ZStack {
            MainWebView()
                .ignoresSafeArea(edges: .bottom)
            BannerOverlay(banner: queue.banner) { queue.dismiss($0) }
            #if DEBUG
            debugButton
            #endif
        }
        #if os(macOS)
        .frame(minWidth: 420, minHeight: 700)
        #endif
        .onAppear {
            queue.onSaved = { WebController.shared.reloadBoard() }
            WebController.shared.presentGame = { launch in
                #if os(iOS)
                game = launch
                #else
                openWindow(id: "game", value: launch)
                #endif
            }
            #if DEBUG
            DebugHooks.start()
            #endif
        }
        #if os(iOS)
        .sheet(item: $game) { launch in
            GameBrowserView(launch: launch)
                .presentationDetents([.large])
        }
        #endif
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            Task { await queue.flush() }
            reloadIfExtensionSaved()
        }
        #if DEBUG
        .sheet(isPresented: $showDebug) { DebugMenu() }
        #endif
    }

    /// The share extension writes `lastSubmissionAt` after each save; reload the board when it moves.
    private func reloadIfExtensionSaved() {
        let last = AppGroup.defaults.double(forKey: "lastSubmissionAt")
        let seen = AppGroup.defaults.double(forKey: "lastSubmissionSeen")
        if last > seen {
            AppGroup.defaults.set(last, forKey: "lastSubmissionSeen")
            WebController.shared.reloadBoard()
        }
    }

    #if DEBUG
    private var debugButton: some View {
        VStack {
            Spacer()
            HStack {
                Spacer()
                Button {
                    showDebug = true
                } label: {
                    Image(systemName: "gearshape.fill")
                        .font(.system(size: 18))
                        .padding(10)
                        .background(.thinMaterial, in: Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Debug menu")
                .padding(16)
            }
        }
    }
    #endif
}
