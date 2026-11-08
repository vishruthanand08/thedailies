#if os(iOS) // the Mac app shows the website instead (MacRootView)
import SwiftUI
import AuthenticationServices

struct SignInView: View {
    private enum Field { case username, password, email }
    @State private var register = false
    @State private var username = ""
    @State private var password = ""
    @State private var email = ""
    @State private var busy = false
    @State private var error: String?
    @FocusState private var focus: Field?
    /// What the server offers: email (asked for at sign-up) and Sign in with Apple.
    @State private var options: (email: Bool, apple: Bool) = (false, false)
    @State private var forgot = false
    /// A new Apple account choosing its username (the Apple sign-in waiting on it).
    @State private var pendingApple: (token: String, code: String?, suggestion: String)?
    @Environment(\.colorScheme) private var colorScheme

    private var needsEmail: Bool { register && options.email }
    private var canSubmit: Bool {
        !busy && !username.trimmingCharacters(in: .whitespaces).isEmpty && password.count >= (register ? 6 : 1)
            && (!needsEmail || email.contains("@"))
    }

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

                if options.apple {
                    VStack(spacing: 12) {
                        SignInWithAppleButton(.continue) { request in
                            request.requestedScopes = [.email]
                        } onCompletion: { result in
                            appleFinished(result)
                        }
                        .signInWithAppleButtonStyle(colorScheme == .dark ? .white : .black)
                        .frame(height: 52)
                        .clipShape(Capsule())
                        .disabled(busy)
                        HStack(spacing: 10) {
                            Capsule().fill(Color.secondary.opacity(0.3)).frame(height: 2)
                            Text("or with a username").font(.footnote.weight(.semibold)).foregroundStyle(.secondary).fixedSize()
                            Capsule().fill(Color.secondary.opacity(0.3)).frame(height: 2)
                        }
                    }
                }

                VStack(spacing: 14) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Username").font(.brand(.subheadline, .semibold)).oneLine()
                        TextField("your_name", text: $username)
                            .textContentType(.username)
                            .textInputAutocapitalization(.never)
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
                            .textContentType(register ? .newPassword : .password)
                            .submitLabel(.go)
                            .focused($focus, equals: .password)
                            .onSubmit { if needsEmail { focus = .email } else { submit() } }
                            .fieldStyle()
                    }
                    if needsEmail {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Email").font(.brand(.subheadline, .semibold)).oneLine()
                            TextField("you@example.com", text: $email)
                                .textContentType(.emailAddress)
                                .keyboardType(.emailAddress)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .submitLabel(.go)
                                .focused($focus, equals: .email)
                                .onSubmit(submit)
                                .fieldStyle()
                            Text("Only for getting back in if you forget your password").font(.footnote).foregroundStyle(.secondary).oneLine()
                        }
                    }

                    if let error {
                        Label(error, hero: "exclamation-circle", filled: true)
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
                    if !register {
                        Button("Forgot password?") { Haptic.tap(); forgot = true }
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.secondary)
                            .frame(minHeight: 36)
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
        .task { options = await DailiesAPI.shared.signInOptions() }
        .sheet(isPresented: $forgot) { ForgotPasswordSheet(initial: username, emailAvailable: options.email) }
        .sheet(isPresented: Binding(get: { pendingApple != nil }, set: { if !$0 { pendingApple = nil } })) {
            if let pending = pendingApple {
                PickUsernameSheet(suggestion: pending.suggestion) { name in
                    _ = try await AppSession.shared.signInWithApple(identityToken: pending.token, code: pending.code, username: name)
                }
            }
        }
    }

    private func appleFinished(_ result: Result<ASAuthorization, Error>) {
        guard case .success(let auth) = result,
              let credential = auth.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = credential.identityToken, let token = String(data: tokenData, encoding: .utf8) else {
            if case .failure(let err) = result, (err as? ASAuthorizationError)?.code == .canceled { return }
            error = "Apple sign-in didn't finish. Try again."
            Haptic.error()
            return
        }
        let code = credential.authorizationCode.flatMap { String(data: $0, encoding: .utf8) }
        busy = true
        error = nil
        Task {
            do {
                if let suggestion = try await AppSession.shared.signInWithApple(identityToken: token, code: code) {
                    pendingApple = (token, code, suggestion)
                }
            } catch let e as DailiesError {
                error = e.message
                Haptic.error()
            } catch {
                self.error = "Couldn't sign in. Try again."
                Haptic.error()
            }
            busy = false
        }
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
        Haptic.tap(.medium)
        Task {
            do {
                try await AppSession.shared.signIn(
                    username: username.trimmingCharacters(in: .whitespaces).lowercased(),
                    password: password, register: register,
                    email: needsEmail ? email.trimmingCharacters(in: .whitespaces).lowercased() : nil)
            } catch let e as DailiesError {
                error = e.message
                Haptic.error()
            } catch {
                self.error = "Couldn't sign in. Try again."
                Haptic.error()
            }
            busy = false
        }
    }
}

/// Forgot password: a reset link by email when the account has one, or support.
private struct ForgotPasswordSheet: View {
    let initial: String
    let emailAvailable: Bool
    @Environment(\.dismiss) private var dismiss
    @State private var login = ""
    @State private var busy = false
    @State private var sent = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 14) {
                if sent {
                    Label("If that account has a confirmed email, a reset link is on its way. It works for an hour.", hero: "check", filled: true)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color.onAccent)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(12)
                        .background(RoundedRectangle(cornerRadius: 12).fill(Color.positive))
                } else if emailAvailable {
                    Text("Enter your username or email and we'll email you a link to choose a new password.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                    TextField("username or email", text: $login)
                        .textContentType(.username)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .submitLabel(.send)
                        .onSubmit(send)
                        .fieldStyle()
                    if let error {
                        Text(error).font(.footnote.weight(.semibold)).foregroundStyle(Color.onAccent)
                            .padding(10).background(RoundedRectangle(cornerRadius: 10).fill(Color.negative))
                    }
                    Button(action: send) {
                        Text(busy ? "Sending…" : "Email me a link")
                            .font(.brand(.headline, .heavy))
                            .foregroundStyle(Color.onAccent)
                            .frame(maxWidth: .infinity, minHeight: 50)
                    }
                    .buttonStyle(.pressIn(.sun, weight: 2.5, shadow: 4))
                    .disabled(busy || login.trimmingCharacters(in: .whitespaces).isEmpty)
                }
                Link(destination: supportURL) {
                    Text(emailAvailable ? "No email on your account? **Email support**" : "**Email support** and we'll help you back in")
                        .font(.subheadline)
                        .foregroundStyle(Color.ink)
                }
                Spacer()
            }
            .padding(20)
            .background(Color.canvas.ignoresSafeArea())
            .navigationTitle("Forgot password")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } } }
        }
        .tint(Color.ink)
        .presentationDetents([.medium, .large])
        .onAppear { login = initial }
    }

    private var supportURL: URL {
        let name = login.trimmingCharacters(in: .whitespaces)
        let body = "Hi! I can't sign in to The Dailies.\n\nMy username: \(name.isEmpty ? "(your username)" : name)\n\nTo help us check it's you, tell us a friend on your board or a recent score:\n"
        var parts = URLComponents()
        parts.scheme = "mailto"
        parts.path = "thedailiessupport@gmail.com"
        parts.queryItems = [URLQueryItem(name: "subject", value: "Reset my password"), URLQueryItem(name: "body", value: body)]
        return parts.url ?? URL(string: "mailto:thedailiessupport@gmail.com")!
    }

    private func send() {
        let value = login.trimmingCharacters(in: .whitespaces)
        guard !value.isEmpty, !busy else { return }
        busy = true
        error = nil
        Task {
            do {
                try await DailiesAPI.shared.forgotPassword(login: value)
                withAnimation(.snappy) { sent = true }
                Haptic.success()
            } catch let e as DailiesError {
                error = e.message
            } catch {}
            busy = false
        }
    }
}

/// A new Sign in with Apple account picks the username friends will find it by.
private struct PickUsernameSheet: View {
    let suggestion: String
    let create: (String) async throws -> Void
    @State private var name = ""
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 14) {
                Text("It's how friends find you. 2–20 letters, numbers or _.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .oneLine()
                TextField("username", text: $name)
                    .textContentType(.username)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .submitLabel(.go)
                    .onSubmit(go)
                    .fieldStyle()
                if let error {
                    Text(error).font(.footnote.weight(.semibold)).foregroundStyle(Color.onAccent)
                        .padding(10).background(RoundedRectangle(cornerRadius: 10).fill(Color.negative))
                }
                Button(action: go) {
                    Text(busy ? "Creating…" : "Start playing")
                        .font(.brand(.headline, .heavy))
                        .foregroundStyle(Color.onAccent)
                        .frame(maxWidth: .infinity, minHeight: 50)
                }
                .buttonStyle(.pressIn(.sun, weight: 2.5, shadow: 4))
                .disabled(busy || name.trimmingCharacters(in: .whitespaces).count < 2)
                Spacer()
            }
            .padding(20)
            .background(Color.canvas.ignoresSafeArea())
            .navigationTitle("Pick a username")
            .navigationBarTitleDisplayMode(.inline)
        }
        .tint(Color.ink)
        .presentationDetents([.medium])
        .interactiveDismissDisabled(busy)
        .onAppear { name = suggestion }
    }

    private func go() {
        let value = name.trimmingCharacters(in: .whitespaces).lowercased()
        guard value.count >= 2, !busy else { return }
        busy = true
        error = nil
        Haptic.tap(.medium)
        Task {
            do {
                try await create(value)
            } catch let e as DailiesError {
                error = e.message
                Haptic.error()
            } catch {}
            busy = false
        }
    }
}

private extension View {
    func fieldStyle() -> some View {
        self
            .font(.body)
            .padding(.horizontal, 14)
            .frame(minHeight: 50)
            .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.canvas.opacity(0.6)))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Color.ink.opacity(0.25), lineWidth: 1.5))
    }
}
#endif
