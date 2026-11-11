#if os(iOS) // the Mac app shows the website instead (MacRootView)
import SwiftUI
import UniformTypeIdentifiers

/// Opened from the + in the tab bar: paste the result a game just copied (system PasteButton,
/// so there's no "Allow Paste?" prompt), or type or paste it into the box.
struct AddScoreSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var typing = false
    @State private var text = ""
    @FocusState private var focused: Bool

    var body: some View {
        NavigationStack {
            ScrollView {
                // the website's paste box: a white card on lavender
                VStack(alignment: .leading, spacing: 14) {
                    HStack(spacing: 10) {
                        HeroIcon("clipboard-document", filled: true, size: 22)
                            .foregroundStyle(Color.onAccent)
                            .frame(width: 44, height: 44)
                            .background(Circle().fill(Color.sun))
                            .overlay(Circle().strokeBorder(Color.onAccent, lineWidth: 2))
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 1) {
                            Text("Paste your result").font(.brand(.headline, .heavy)).foregroundStyle(Color.ink).oneLine()
                            Text("Tap Share or Copy in the game, then paste.")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                                .oneLine()
                        }
                    }

                    // the system button reads the clipboard without the "Allow Paste?" prompt
                    Group {
                        #if DEBUG
                        if UserDefaults.standard.bool(forKey: "dailiesScreenshots") {
                            ScreenshotPasteButton()
                        } else {
                            pasteButton
                        }
                        #else
                        pasteButton
                        #endif
                    }
                    .labelStyle(.titleAndIcon)
                    .buttonBorderShape(.capsule)
                    .controlSize(.extraLarge)
                    .tint(Color.onAccent)
                    .frame(maxWidth: .infinity)

                    if typing {
                        TextEditor(text: $text)
                            .focused($focused)
                            .font(.subheadline.monospaced())
                            .scrollContentBackground(.hidden)
                            .padding(8)
                            .frame(minHeight: 120)
                            .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.canvas))
                            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Color.onAccent, lineWidth: 2))
                            .foregroundStyle(Color.ink)
                            .accessibilityLabel("Game result")
                        Button(action: add) {
                            Text("Add score")
                                .font(.brand(.subheadline, .heavy))
                                .foregroundStyle(Color.surface)
                                .frame(maxWidth: .infinity, minHeight: 48)
                        }
                        .buttonStyle(.pressIn(.ink))
                        .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    } else {
                        Button {
                            Haptic.tap()
                            withAnimation(.snappy) { typing = true }
                            focused = true
                        } label: {
                            Label("Type or paste it instead", hero: "pencil-square")
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(Color.ink)
                                .oneLine(.center)
                                .frame(minHeight: 44)
                        }
                    }
                }
                .padding(18)
                .chunkyCard(.surface)
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 20)
            }
            .scrollBounceBehavior(.basedOnSize)
            .background(Color.canvas.ignoresSafeArea())
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } }
            }
        }
        .tint(Color.ink)
        .presentationBackground(Color.canvas)
        .presentationDetents(typing ? [.large] : [.height(330), .large])
        .presentationDragIndicator(.visible)
    }

    private var pasteButton: some View {
        ResultPasteButton { text in
            Haptic.tap(.medium) // success or error follows when it's saved (TodayView)
            SubmissionQueue.shared.enqueue(text)
            dismiss()
        }
    }

    private func add() {
        Haptic.tap(.medium)
        SubmissionQueue.shared.enqueue(text)
        dismiss()
    }
}

/// The system Paste button (no "Allow Paste?" prompt) for a copied result: text, or a link, since
/// a share sheet's Copy of a link-only result (The Mini's) puts a URL on the clipboard, which a
/// text-only button greys out for.
struct ResultPasteButton: View {
    let onText: @MainActor (String) -> Void

    var body: some View {
        PasteButton(supportedContentTypes: [.plainText, .url]) { providers in
            Task { @MainActor in
                if let text = await Self.text(from: providers) { onText(text) }
            }
        }
    }

    private static func text(from providers: [NSItemProvider]) async -> String? {
        for provider in providers {
            for type in [UTType.plainText, .url] where provider.hasItemConformingToTypeIdentifier(type.identifier) {
                let text: String? = await withCheckedContinuation { done in
                    provider.loadItem(forTypeIdentifier: type.identifier, options: nil) { item, _ in
                        switch item {
                        case let s as String: done.resume(returning: s)
                        case let u as URL: done.resume(returning: u.absoluteString)
                        case let d as Data: done.resume(returning: String(data: d, encoding: .utf8))
                        default: done.resume(returning: nil)
                        }
                    }
                }
                if let text, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return text }
            }
        }
        return nil
    }
}

#if DEBUG
/// -dailiesScreenshots YES: the system Paste button as it looks with a result copied. The
/// Simulator's clipboard is empty (which greys the real one out), and filling it could sync to
/// the Mac's clipboard.
struct ScreenshotPasteButton: View {
    var body: some View {
        Button {} label: { Label("Paste", hero: "clipboard-document") }
            .buttonStyle(.borderedProminent)
            .buttonBorderShape(.capsule)
    }
}
#endif // DEBUG
#endif
