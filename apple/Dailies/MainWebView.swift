import SwiftUI
import WebKit

/// Hosts `WebController.shared.webView`; the view is reused, never recreated.
#if os(iOS)
struct MainWebView: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView { WebController.shared.webView }
    func updateUIView(_ view: WKWebView, context: Context) {}
}
#else
struct MainWebView: NSViewRepresentable {
    func makeNSView(context: Context) -> WKWebView { WebController.shared.webView }
    func updateNSView(_ view: WKWebView, context: Context) {}
}
#endif
