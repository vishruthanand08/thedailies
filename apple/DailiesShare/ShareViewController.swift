import SwiftUI
import UIKit
import UniformTypeIdentifiers

/// "The Dailies" in the share sheet: submits the shared text straight to the server with the
/// device token the app stored in the shared keychain. No queue; the extension is short-lived.
final class ShareViewController: UIViewController {
    private let model = ShareModel()

    override func viewDidLoad() {
        super.viewDidLoad()
        model.finish = { [weak self] in self?.extensionContext?.completeRequest(returningItems: nil) }

        let host = UIHostingController(rootView: ShareView(model: model))
        addChild(host)
        host.view.frame = view.bounds
        host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        host.view.backgroundColor = .clear
        view.addSubview(host.view)
        host.didMove(toParent: self)

        let items = extensionContext?.inputItems.compactMap { $0 as? NSExtensionItem } ?? []
        Task { await model.run(items) }
    }
}

@MainActor
@Observable
final class ShareModel {
    enum State: Equatable {
        case working
        case noToken
        case saved(SubmissionResult)
        case failed(String)
    }

    var state: State = .working
    @ObservationIgnored var finish: () -> Void = {}

    func run(_ items: [NSExtensionItem]) async {
        guard Keychain.load() != nil else {
            state = .noToken
            return
        }
        let text = await Self.collect(items)
        guard !text.isEmpty else {
            state = .failed("Nothing to save. Share the result text from the game's Share button.")
            return
        }
        do {
            let result = try await DailiesAPI.shared.submit(text: text)
            state = .saved(result)
            AppGroup.defaults.set(Date().timeIntervalSince1970, forKey: "lastSubmissionAt")
            try? await Task.sleep(for: .seconds(1.5))
            finish()
        } catch let error as DailiesError {
            if case .notSignedIn = error { state = .noToken } else { state = .failed(error.message) }
        } catch {
            state = .failed("Couldn't save that score.")
        }
    }

    private static func collect(_ items: [NSExtensionItem]) async -> String {
        var texts: [String] = []
        var urls: [URL] = []
        for item in items {
            if let s = item.attributedContentText?.string { texts.append(s) }
            for provider in item.attachments ?? [] {
                if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier),
                   let s = try? await provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) as? String {
                    texts.append(s)
                } else if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier),
                          let u = try? await provider.loadItem(forTypeIdentifier: UTType.url.identifier) as? URL {
                    urls.append(u)
                }
            }
        }
        return ShareInput.combine(texts: texts, urls: urls)
    }
}

struct ShareView: View {
    let model: ShareModel
    private let ink = Color(red: 0.086, green: 0.086, blue: 0.18)

    var body: some View {
        VStack(spacing: 14) {
            switch model.state {
            case .working:
                ProgressView()
                Text("Saving to The Dailies…").font(.headline)
            case .noToken:
                Text("Open The Dailies and sign in first").font(.headline).multilineTextAlignment(.center)
                Text("The app saves a device token when you sign in. Then sharing works from any game.")
                    .font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.center)
                doneButton
            case .saved(let r):
                Text(r.emoji).font(.system(size: 44))
                Text("\(r.gameName) \(r.display)").font(.title3.weight(.bold))
                Text("Saved ✓").font(.headline).foregroundStyle(.green)
            case .failed(let message):
                Text("Not saved").font(.headline)
                Text(message).font(.subheadline).multilineTextAlignment(.center)
                doneButton
            }
        }
        .foregroundStyle(ink)
        .padding(24)
        .frame(maxWidth: 360)
        .background(RoundedRectangle(cornerRadius: 20).fill(Color(red: 0.914, green: 0.894, blue: 0.969)))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(ink, lineWidth: 2.5))
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black.opacity(0.25))
    }

    private var doneButton: some View {
        Button("Done") { model.finish() }
            .font(.headline)
            .padding(.horizontal, 28)
            .padding(.vertical, 10)
            .background(Capsule().fill(Color(red: 0.949, green: 0.451, blue: 0.361)))
            .overlay(Capsule().stroke(ink, lineWidth: 2.5))
            .foregroundStyle(ink)
    }
}
