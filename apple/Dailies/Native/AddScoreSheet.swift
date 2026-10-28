#if os(iOS) // the Mac app shows the website instead (MacRootView)
import SwiftUI

/// Opened from the + in the tab bar: paste the result a game just copied (system PasteButton,
/// so there's no "Allow Paste?" prompt), or type or paste it into the box.
struct AddScoreSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var typing = false
    @State private var text = ""
    @FocusState private var focused: Bool

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                VStack(spacing: 6) {
                    Image(systemName: "doc.on.clipboard.fill")
                        .font(.system(size: 30, weight: .semibold))
                        .foregroundStyle(Color.onAccent)
                        .frame(width: 64, height: 64)
                        .background(Circle().fill(Color.white))
                        .overlay(Circle().strokeBorder(Color.onAccent, lineWidth: 2))
                        .accessibilityHidden(true)
                    Text("Add a score").font(.brand(.title2, .heavy)).oneLine(.center)
                    Text("Tap Share or Copy in the game, then paste.")
                        .font(.subheadline)
                        .opacity(0.75)
                        .oneLine(.center)
                }
                .foregroundStyle(Color.onAccent)

                PasteButton(payloadType: String.self) { strings in
                    guard let text = strings.first else { return }
                    Task { @MainActor in
                        SubmissionQueue.shared.enqueue(text)
                        dismiss()
                    }
                }
                .labelStyle(.titleAndIcon)
                .buttonBorderShape(.capsule)
                .controlSize(.extraLarge)
                .tint(Color.onAccent)

                if typing {
                    TextEditor(text: $text)
                        .focused($focused)
                        .font(.body.monospaced())
                        .scrollContentBackground(.hidden)
                        .padding(8)
                        .frame(minHeight: 120)
                        .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.white))
                        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Color.onAccent, lineWidth: 2))
                        .foregroundStyle(Color.onAccent)
                        .accessibilityLabel("Game result")
                } else {
                    Button {
                        withAnimation(.snappy) { typing = true }
                        focused = true
                    } label: {
                        Label("Type or paste it instead", systemImage: "keyboard")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Color.onAccent)
                            .oneLine(.center)
                            .frame(minHeight: 44)
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)
            .background(Color.sun.ignoresSafeArea()) // yellow in both modes, like the tab bar
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } }
                if typing {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Add") {
                            SubmissionQueue.shared.enqueue(text)
                            dismiss()
                        }
                        .fontWeight(.bold)
                        .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                }
            }
        }
        .tint(Color.onAccent)
        .presentationBackground(Color.sun)
        .presentationDetents(typing ? [.large] : [.height(340), .large])
        .presentationDragIndicator(.visible)
    }
}
#endif
