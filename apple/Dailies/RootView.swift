import SwiftUI

struct RootView: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var queue = SubmissionQueue.shared
    @State private var session = AppSession.shared
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
            // native screens; the web view only backs the sections that aren't native yet
            switch session.state {
            case .signedIn:
                #if os(iOS)
                AppTabs()
                #else
                MacRootView()
                #endif
            case .signedOut: SignInView()
            }
            BannerOverlay(banner: queue.banner) { queue.dismiss($0) }
            #if DEBUG
            // -dailiesScreenshots YES hides it for App Store screenshots
            if !UserDefaults.standard.bool(forKey: "dailiesScreenshots") { debugButton }
            #endif
        }
        #if os(macOS)
        .frame(minWidth: 820, minHeight: 560) // room for the sidebar and the day
        #endif
        .onAppear {
            queue.onSaved = {
                WebController.shared.reloadBoard()
                Task { await TodayModel.shared.reload() }
            }
            Task { await session.verify() }
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
        // full screen, not a sheet: games like Zip and Strands are played by dragging, and a
        // downward drag would pull a sheet closed. Done is the only way out.
        .fullScreenCover(item: $game) { launch in
            GameBrowserView(launch: launch)
        }
        #endif
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            Task { await queue.flush() }
            reloadIfExtensionSaved()
            // a new day may have started, or friends posted while the app was away
            if session.username != nil { Task { await TodayModel.shared.reload() } }
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
            Task { await TodayModel.shared.reload() }
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
                .padding(.trailing, 16)
                .padding(.bottom, 150) // clear of the tab bar and the paste bar
            }
        }
    }
    #endif
}
