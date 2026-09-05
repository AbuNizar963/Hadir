import Foundation

struct Employee: Codable, Identifiable {
    let id: String
    let name: String?
    let jobNumber: String?
}

struct LoginRequest: Codable {
    let username: String
    let password: String
    let deviceId: String
    let deviceLabel: String
    let deviceFingerprint: String
}

struct LoginResponse: Codable {
    let token: String
    let user: Employee
    let kind: String
}

struct AttendanceRecord: Codable, Identifiable {
    let id: String
    let employeeId: String
    let type: String
    let timestamp: String
    let lat: Double?
    let lng: Double?
}

struct AttendanceChallengeRequest: Codable {
    let type: String
    let lat: Double
    let lng: Double
    let qrCode: String
    let deviceId: String?
}

struct AttendanceChallengeResponse: Codable {
    let ok: Bool
    let challengeId: String
    let expiresAt: String
}

final class HadirAPI {
    static let shared = HadirAPI()
    private let baseURL = URL(string: "https://hadir-api.abunizar963.workers.dev")!
    private let session = URLSession.shared

    func login(username: String, password: String, deviceId: String) async throws -> LoginResponse {
        try await send(path: "/api/auth/login", method: "POST", body: LoginRequest(username: username, password: password, deviceId: deviceId, deviceLabel: "iPhone", deviceFingerprint: deviceId), authenticated: false)
    }

    func attendance(token: String) async throws -> [AttendanceRecord] {
        try await send(path: "/api/attendance?limit=200", method: "GET", body: Optional<String>.none, authenticated: true, token: token)
    }

    func challenge(token: String, request: AttendanceChallengeRequest) async throws -> AttendanceChallengeResponse {
        try await send(path: "/api/attendance/challenge", method: "POST", body: request, authenticated: true, token: token)
    }

    private func send<T: Decodable, Body: Encodable>(path: String, method: String, body: Body?, authenticated: Bool, token: String? = nil) async throws -> T {
        var request = URLRequest(url: baseURL.appendingPathComponent(path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))))
        request.httpMethod = method
        request.timeoutInterval = 20
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if authenticated, let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body { request.httpBody = try JSONEncoder().encode(body) }
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            if let serverError = try? JSONDecoder().decode([String: String].self, from: data), let message = serverError["error"] { throw NSError(domain: "Hadir", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
            throw NSError(domain: "Hadir", code: 2, userInfo: [NSLocalizedDescriptionKey: "تعذر الاتصال بخادم حاضر."])
        }
        return try JSONDecoder().decode(T.self, from: data)
    }
}
