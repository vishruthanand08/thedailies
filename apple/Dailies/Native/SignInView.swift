import SwiftUI

struct SignInView: View {
    private enum Field { case username, password }
    @State private var register = false
    @State private var username = ""
    @State private var password = ""
    @State private var busy = false
    @State private var error: String?
    @FocusState private var focus: Field?

    private var canSubmit: Bool { !busy && !username.trimmingCharacters(in: .whitespaces).isEmpty && password.count >= (register ? 6 : 1) }

    var body: some View {
        ScrollView {
            VStack(spacing: 28) {
                logo
                    .padding(.top, 40)

                VStack(spacing: 10) {
                    Text("Beat your friends")
                        .font(.brand(.largeTitle, .heavy))
                        .oneLine(.center)
                    Text("at everything")
                        .font(.brand(.largeTitle, .heavy))
                        .lineLimit(1)
                        .padding(.horizontal, 6)
                        .background(alignment: .bottom) {
                            // the site's yellow marker stroke under the punchline
                            RoundedRectangle(cornerRadius: 4).fill(Color.sun).frame(height: 14).offset(y: -6).rotationEffect(.degrees(-1))
                        }
                    Text("One leaderboard for all your daily games.")
                        .font(.body)
                        .foregroundStyle(.secondary)
                        .oneLine(.center)
                        .padding(.top, 4)
                }

                VStack(spacing: 14) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Username").font(.brand(.subheadline, .semibold)).oneLine()
                        TextField("your_name", text: $username)
                            .textContentType(.username)
                            #if os(iOS)
                            .textInputAutocapitalization(.never)
                            #endif
                            .autocorrectionDisabled()
                            .submitLabel(.next)
                            .focused($focus, equals: .username)
                            .onSubmit { focus = .password }
                            .fieldStyle()
                        if register {
                            Text("2–20 letters, numbers or _").font(.footnote).foregroundStyle(.secondary).oneLine()
                        }
                    }
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Password").font(.brand(.subheadline, .semibold)).oneLine()
                        SecureField(register ? "6 or more characters" : "Password", text: $password)
                            #if os(iOS)
                            .textContentType(register ? .newPassword : .password)
                            #else
                            .textContentType(.password)
                            #endif
                            .submitLabel(.go)
                            .focused($focus, equals: .password)
                            .onSubmit(submit)
                            .fieldStyle()
                    }

                    if let error {
                        Label(error, systemImage: "exclamationmark.circle.fill")
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(Color.onAccent)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(12)
                            .background(RoundedRectangle(cornerRadius: 12).fill(Color.negative))
                            .accessibilityElement(children: .combine)
                    }

                    Button(action: submit) {
                        ZStack {
                            Text(register ? "Create account" : "Sign in").lineLimit(1).opacity(busy ? 0 : 1)
                            if busy { ProgressView().tint(Color.onAccent) }
                        }
                        .font(.brand(.headline, .heavy))
                        .foregroundStyle(Color.onAccent)
                        .frame(maxWidth: .infinity, minHeight: 52)
                    }
                    .buttonStyle(.pressIn(.sun, weight: 2.5, shadow: 4))
                    .disabled(!canSubmit)
                    .opacity(canSubmit || busy ? 1 : 0.5)

                    Button {
                        withAnimation(.snappy) { register.toggle(); error = nil }
                    } label: {
                        Text(register ? "Already have an account? **Sign in**" : "New here? **Make an account**")
                            .font(.subheadline)
                            .foregroundStyle(Color.ink)
                            .oneLine(.center)
                            .frame(maxWidth: .infinity, minHeight: 44)
                    }
                }
                .padding(20)
                .chunkyCard(.surface)

                HStack(spacing: 20) {
                    Link("Privacy Policy", destination: Server.current.baseURL.appending(path: "/privacy"))
                    Link("Support", destination: Server.current.baseURL.appending(path: "/support"))
                }
                .font(.footnote.weight(.medium))
                .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 32)
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(Color.canvas.ignoresSafeArea())
    }

    private var logo: some View {
        HStack(spacing: 6) {
            Text("The")
                .foregroundStyle(Color.canvas)
                .padding(.horizontal, 12)
                .padding(.vertical, 2)
                .background(RoundedRectangle(cornerRadius: 10).fill(Color.ink)) // inverts in dark mode
                .rotationEffect(.degrees(-3))
            Text("Dailies")
        }
        .font(.brand(.title, .heavy))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("The Dailies")
    }

    private func submit() {
        guard canSubmit else { return }
        busy = true
        error = nil
        focus = nil
        Task {
            do {
                try await AppSession.shared.signIn(
                    username: username.trimmingCharacters(in: .whitespaces).lowercased(),
                    password: password, register: register)
            } catch let e as DailiesError {
                error = e.message
            } catch {
                self.error = "Couldn't sign in. Try again."
            }
            busy = false
        }
    }
}

private extension View {
    func fieldStyle() -> some View {
        self
            #if os(macOS)
            .textFieldStyle(.plain)
            #endif
            .font(.body)
            .padding(.horizontal, 14)
            .frame(minHeight: 50)
            .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.canvas.opacity(0.6)))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Color.ink.opacity(0.25), lineWidth: 1.5))
    }
}
