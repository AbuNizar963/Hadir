import Foundation
import Security
import SwiftUI
import UIKit

@MainActor
final class HadirSession: ObservableObject {
    @Published var employee: Employee?
    @Published var attendance: [AttendanceRecord] = []
    @Published var loading = false
    @Published var error: String?

    private let api = HadirAPI.shared
    private let keychainKey = "com.hadir.attendance.token"

    func login(username: String, password: String) async {
        loading = true; error = nil
        do {
            let deviceId = UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString
            let response = try await api.login(username: username, password: password, deviceId: deviceId)
            guard response.kind == "employee" else { throw NSError(domain: "Hadir", code: 1, userInfo: [NSLocalizedDescriptionKey: "هذا الحساب ليس حساب موظف"]) }
            saveToken(response.token)
            employee = response.user
            attendance = (try? await api.attendance(token: response.token)) ?? []
        } catch { error = error.localizedDescription }
        loading = false
    }

    func logout() { deleteToken(); employee = nil; attendance = [] }

    private func saveToken(_ token: String) {
        let data = Data(token.utf8)
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrAccount as String: keychainKey, kSecValueData as String: data]
        SecItemDelete(query as CFDictionary); SecItemAdd(query as CFDictionary, nil)
    }

    private func readToken() -> String? {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrAccount as String: keychainKey, kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private func deleteToken() {
        SecItemDelete([kSecClass as String: kSecClassGenericPassword, kSecAttrAccount as String: keychainKey] as CFDictionary)
    }
}
