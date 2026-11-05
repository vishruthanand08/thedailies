#if os(iOS) // the Mac app shows the website instead (MacRootView)
import SwiftUI

/// You (the profile, a sheet from the button at the top right of each tab), in Today's style: who you are and your numbers on the yellow card, your stats over a range,
/// game by game, then your account (password, help, sign out, delete account).
struct YouView: View {
    @State private var model = YouModel.shared
    @State private var signingOut = false
    @State private var deleting = false

    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 16) {
                        ProfileCard(model: model)
                        StatsCard(model: model)
                        if !model.games.isEmpty { ByGameCard(lines: model.games).id("games") }
                        PasswordCard(model: model)
                        HelpCard()
                        AccountCard(onSignOut: { signingOut = true }, onDelete: { deleting = true }).id("account")
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
                    .padding(.bottom, 24)
                }
                #if DEBUG
                // -dailiesScrollTo games|account: start scrolled there (scripted Simulator runs)
                .task(id: model.stats == nil) {
                    guard model.stats != nil, let id = UserDefaults.standard.string(forKey: "dailiesScrollTo") else { return }
                    proxy.scrollTo(id, anchor: .top)
                }
                #endif
            }
            .scrollIndicators(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .background(Color.canvas.ignoresSafeArea())
            .navigationTitle("You")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { ProfileSheet.shared.open = false }.font(.brand(.body, .bold))
                }
            }
            .refreshable { await model.load() }
        }
        .tint(Color.ink)
        .task { await model.load() }
        .confirmationDialog("Sign out of The Dailies?", isPresented: $signingOut, titleVisibility: .visible) {
            Button("Sign out", role: .destructive) {
                Haptic.warning()
                AppSession.shared.signOut()
            }
        }
        .sheet(isPresented: $deleting) { DeleteAccountSheet(model: model) }
    }
}

/// The yellow card at the top, like the crown: your initial, your name, when you started, and
/// your headline numbers.
private struct ProfileCard: View {
    let model: YouModel

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                Text((model.me ?? "?").prefix(1).uppercased())
                    .font(.system(.title, design: .rounded, weight: .heavy))
                    .foregroundStyle(Color.onAccent)
                    .frame(width: 60, height: 60)
                    .background(Circle().fill(Color.white.opacity(0.85)))
                    .overlay(Circle().strokeBorder(Color.onAccent, lineWidth: 2.5))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text("@\(model.me ?? "")").font(.brand(.title2, .heavy)).oneLine()
                    Text(model.joinedText ?? " ")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Color.onAccent.opacity(0.7))
                        .oneLine()
                }
            }
            HStack(spacing: 8) {
                headline("\(model.mine?.points ?? 0)", "points", value: model.mine?.points ?? 0)
                headline("\(model.mine?.crowns ?? 0)", "crowns", value: model.mine?.crowns ?? 0)
                headline("\(model.mine?.streak ?? 0)", "day streak", value: model.mine?.streak ?? 0, icon: (model.mine?.streak ?? 0) > 0 ? "fire" : nil)
            }
        }
        .foregroundStyle(Color.onAccent)
        .padding(14)
        .chunkyCard(.sun)
        .padding(.trailing, 4)
        .padding(.bottom, 4)
        .accessibilityElement(children: .combine)
    }

    private func headline(_ text: String, _ label: String, value: Int, icon: String? = nil) -> some View {
        VStack(spacing: 0) {
            HStack(spacing: 3) {
                Text(text).font(.brand(.title3, .heavy)).rolling(value)
                if let icon { HeroIcon(icon, filled: true, size: 16) }
            }
            Text(label).font(.caption.weight(.bold)).foregroundStyle(Color.onAccent.opacity(0.7))
        }
        .lineLimit(1)
        .frame(maxWidth: .infinity, minHeight: 52)
        .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.white.opacity(0.75)))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Color.onAccent, lineWidth: 1.5))
    }
}

/// Every number over a range, as tiles.
private struct StatsCard: View {
    @Bindable var model: YouModel
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        SectionCard(title: "Your stats", icon: "chart-bar") {
            RangeChips(range: $model.range)
            if let error = model.error, model.stats == nil {
                NoticeView(ok: false, text: error)
            } else if model.stats == nil {
                ProgressView().frame(maxWidth: .infinity, minHeight: 80)
            } else if let mine = model.mine {
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) {
                    tile("Points", mine.points)
                    tile("Crowns", mine.crowns, icon: "trophy")
                    tile("Game wins", mine.wins)
                    tile("Scores", mine.played)
                    tile("Days played", mine.daysPlayed ?? 0)
                    tile("Streak", mine.streak, icon: mine.streak > 0 ? "fire" : nil)
                    tile("Best streak", mine.bestStreak ?? 0)
                    mostPlayed
                }
                Text("Crowns and wins count when you beat a friend")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .oneLine()
            } else {
                EmptyState(art: "EmptyBoard", icon: "chart-bar", title: "No scores \(model.range == .all ? "yet" : "in this range")",
                           message: "Play a game on Today and your stats show up here.", compact: true)
            }
        }
    }

    private func tile(_ label: String, _ value: Int, icon: String? = nil) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 4) {
                Text("\(value)").font(.brand(.title3, .heavy)).rolling(value)
                if let icon { HeroIcon(icon, filled: true, size: 16) }
            }
            Text(label).font(.caption.weight(.semibold)).foregroundStyle(.secondary).oneLine()
        }
        .foregroundStyle(Color.ink)
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.canvas))
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private var mostPlayed: some View {
        let top = model.games.first
        HStack(spacing: 8) {
            if let top { GameAvatar(game: top.game, size: 30) }
            VStack(alignment: .leading, spacing: 2) {
                Text(top?.game.name ?? "–").font(.brand(.subheadline, .heavy)).oneLine()
                Text("Most played").font(.caption.weight(.semibold)).foregroundStyle(.secondary).oneLine()
            }
        }
        .foregroundStyle(Color.ink)
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .frame(maxHeight: .infinity)
        .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.canvas))
        .accessibilityElement(children: .combine)
    }
}

/// Each game I've played: how often, wins, best and average.
private struct ByGameCard: View {
    let lines: [YouModel.GameLine]
    @State private var showAll = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    private let shown = 6

    var body: some View {
        SectionCard(title: "By game", icon: "squares-2x2") {
            VStack(spacing: 6) {
                ForEach(showAll ? lines : Array(lines.prefix(shown))) { line in
                    HStack(spacing: 10) {
                        GameAvatar(game: line.game, size: 34)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(line.game.name).font(.brand(.subheadline, .heavy)).oneLine()
                            Text("\(line.played) played · \(line.wins) \(line.wins == 1 ? "win" : "wins")")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.secondary)
                                .oneLine()
                        }
                        VStack(alignment: .trailing, spacing: 1) {
                            Text(line.best).font(.brand(.subheadline, .heavy)).monospacedDigit()
                            Text("avg \(line.average)").font(.caption.weight(.semibold)).monospacedDigit().foregroundStyle(.secondary)
                        }
                        .lineLimit(1)
                        .fixedSize()
                    }
                    .foregroundStyle(Color.ink)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(line.game.name): \(line.played) played, \(line.wins) wins, best \(line.best), average \(line.average)")
                }
            }
            if lines.count > shown {
                Button {
                    Haptic.select()
                    withAnimation(reduceMotion ? nil : .snappy) { showAll.toggle() }
                } label: {
                    HStack(spacing: 4) {
                        Text(showAll ? "Show less" : "Show all \(lines.count)")
                        HeroIcon(showAll ? "chevron-up" : "chevron-down", size: 12)
                    }
                    .font(.brand(.footnote, .bold))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, minHeight: 32)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.pressIn)
            }
        }
    }
}

/// A password field in the app's sunken style.
private struct PasswordField: View {
    let placeholder: String
    @Binding var text: String
    var newPassword = false
    @FocusState private var focused: Bool

    var body: some View {
        SecureField(placeholder, text: $text)
            .textContentType(newPassword ? .newPassword : .password)
            .font(.brand(.subheadline, .semibold))
            .foregroundStyle(Color.ink)
            .focused($focused)
            .padding(.horizontal, 12)
            .frame(minHeight: 44)
            .modifier(Sunken(down: focused, fill: .canvas))
            .contentShape(Rectangle())
            .onTapGesture { focused = true }
    }
}

private struct PasswordCard: View {
    let model: YouModel
    @State private var open = false
    @State private var current = ""
    @State private var next = ""
    @State private var busy = false
    @State private var flash: (ok: Bool, text: String)?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        SectionCard(title: "Password", icon: "lock-closed") {
            if !open {
                SmallButton(title: "Change") {
                    withAnimation(reduceMotion ? nil : .snappy) { open = true; flash = nil }
                }
            }
        } content: {
            if open {
                PasswordField(placeholder: "Current password", text: $current)
                PasswordField(placeholder: "New password (6+ characters)", text: $next, newPassword: true)
                HStack(spacing: 8) {
                    SmallButton(title: busy ? "Saving…" : "Save", primary: true, action: save)
                        .disabled(busy || current.isEmpty || next.count < 6)
                    SmallButton(title: "Cancel") {
                        withAnimation(reduceMotion ? nil : .snappy) { open = false; current = ""; next = "" }
                    }
                }
            }
            if let flash {
                NoticeView(ok: flash.ok, text: flash.text)
            }
        }
        .sensoryFeedback(trigger: flash?.text) { _, _ in
            guard let flash else { return nil }
            return flash.ok ? .success : .error
        }
    }

    private func save() {
        busy = true
        Task {
            let failed = await model.changePassword(current: current, next: next)
            busy = false
            withAnimation(reduceMotion ? nil : .snappy) {
                if let failed {
                    flash = (false, failed)
                } else {
                    flash = (true, "Password changed")
                    open = false
                    current = ""
                    next = ""
                }
            }
        }
    }
}

/// Privacy, support and reporting: open in Safari or Mail.
private struct HelpCard: View {
    var body: some View {
        SectionCard(title: "Help", icon: "information-circle") {
            VStack(spacing: 0) {
                row("Privacy Policy", icon: "lock-closed", url: Server.current.baseURL.appending(path: "privacy"))
                Divider()
                row("Help & support", icon: "information-circle", url: Server.current.baseURL.appending(path: "support"))
                Divider()
                row("Report a problem or a user", icon: "flag",
                    url: URL(string: "mailto:thedailiessupport@gmail.com?subject=Report%20a%20problem")!)
            }
        }
    }

    private func row(_ title: String, icon: String, url: URL) -> some View {
        Link(destination: url) {
            HStack(spacing: 10) {
                HeroIcon(icon, size: 18)
                Text(title).font(.brand(.subheadline, .bold)).oneLine()
                HeroIcon("chevron-right", size: 14).foregroundStyle(.secondary)
            }
            .foregroundStyle(Color.ink)
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.pressIn)
        .simultaneousGesture(TapGesture().onEnded { Haptic.tap() })
    }
}

private struct AccountCard: View {
    let onSignOut: () -> Void
    let onDelete: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            Button {
                Haptic.tap(.medium)
                onSignOut()
            } label: {
                Text("Sign out")
                    .font(.brand(.subheadline, .heavy))
                    .foregroundStyle(Color.ink)
                    .frame(maxWidth: .infinity, minHeight: 48)
            }
            .buttonStyle(.pressIn(.surface, radius: 16))

            Button {
                Haptic.tap()
                onDelete()
            } label: {
                Label("Delete account", hero: "trash", size: 16)
                    .font(.brand(.footnote, .bold))
                    .foregroundStyle(.secondary)
                    .labelStyle(.titleAndIcon)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.pressIn)
        }
        .padding(.trailing, 4)
    }
}

/// App Store guideline 5.1.1(v): an account made in the app can be deleted in the app. The
/// password confirms it.
private struct DeleteAccountSheet: View {
    let model: YouModel
    @Environment(\.dismiss) private var dismiss
    @State private var password = ""
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 14) {
                Label("This can't be undone", hero: "exclamation-circle", filled: true, size: 20)
                    .font(.brand(.headline, .heavy))
                    .foregroundStyle(Color.ink)
                    .oneLine()
                // a full warning: this one wraps, like an error message
                Text("Deleting your account removes your scores, friendships and suggestions for good.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                PasswordField(placeholder: "Your password", text: $password)
                if let error {
                    NoticeView(ok: false, text: error)
                }
                Button(action: delete) {
                    Text(busy ? "Deleting…" : "Delete my account")
                        .font(.brand(.subheadline, .heavy))
                        .foregroundStyle(Color.onAccent)
                        .frame(maxWidth: .infinity, minHeight: 48)
                }
                .buttonStyle(.pressIn(Color.negative, radius: 16))
                .disabled(password.isEmpty || busy)
                Spacer()
            }
            .padding(20)
            .background(Color.canvas.ignoresSafeArea())
            .navigationTitle("Delete account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            }
        }
        .presentationDetents([.medium])
        .tint(Color.ink)
    }

    private func delete() {
        busy = true
        error = nil
        Task {
            if let failed = await model.deleteAccount(password: password) {
                Haptic.error()
                error = failed
                busy = false
            } else {
                Haptic.warning()
                dismiss()
            }
        }
    }
}
#endif
