import SwiftUI

@main
struct HadirNativeApp: App {
    @StateObject private var session = HadirSession()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(session)
                .environment(\.layoutDirection, .rightToLeft)
        }
    }
}
