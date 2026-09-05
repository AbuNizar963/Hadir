import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var session: HadirSession
    @State private var username = ""
    @State private var password = ""

    var body: some View {
        NavigationStack {
            Group {
                if session.employee != nil { HomeView() }
                else { LoginView(username: $username, password: $password) }
            }
            .navigationTitle("حاضر")
        }
    }
}

private struct LoginView: View {
    @EnvironmentObject private var session: HadirSession
    @Binding var username: String
    @Binding var password: String

    var body: some View {
        Form {
            Section("تسجيل دخول الموظف") {
                TextField("رقم الموظف", text: $username)
                    .textInputAutocapitalization(.never)
                SecureField("الرمز / كلمة المرور", text: $password)
                if let error = session.error { Text(error).foregroundStyle(.red) }
                Button(session.loading ? "جارٍ الدخول…" : "دخول") {
                    Task { await session.login(username: username.trimmingCharacters(in: .whitespacesAndNewlines), password: password) }
                }
                .disabled(username.isEmpty || password.isEmpty || session.loading)
            }
        }
    }
}

private struct HomeView: View {
    @EnvironmentObject private var session: HadirSession
    var body: some View {
        List {
            Section("الموظف") {
                Text(session.employee?.name ?? "موظف")
                Text("رقم الموظف: \(session.employee?.jobNumber ?? "—")")
            }
            Section("الحضور") {
                Text("السجلات: \(session.attendance.count)")
                NavigationLink("تسجيل الحضور") { AttendancePlaceholderView() }
                NavigationLink("سجل الحضور") { AttendanceHistoryView() }
            }
            Button("تسجيل الخروج", role: .destructive) { session.logout() }
        }
    }
}

private struct AttendancePlaceholderView: View {
    var body: some View {
        ContentUnavailableView("الحضور الآمن", systemImage: "qrcode.viewfinder", description: Text("سيتم تشغيل تدفق QR + الموقع الأصلي داخل هذه الشاشة."))
            .navigationTitle("تسجيل الحضور")
    }
}

private struct AttendanceHistoryView: View {
    @EnvironmentObject private var session: HadirSession
    var body: some View {
        List(session.attendance) { record in
            VStack(alignment: .leading) {
                Text(record.type == "check-in" ? "دخول" : "خروج")
                    .font(.headline)
                Text(record.timestamp).font(.caption)
            }
        }
        .navigationTitle("سجل الحضور")
    }
}
