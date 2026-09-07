package com.hadir.attendance.data

import com.squareup.moshi.Json
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

const val HADIR_API = "https://hadir-api.abunizar963.workers.dev/"

data class LoginRequest(val username: String, val password: String, val deviceId: String, val deviceLabel: String, val deviceFingerprint: String)
data class AdminLoginRequest(val username: String, val password: String)
data class LoginResponse<T>(val token: String, val user: T, val kind: String)
data class Employee(val id: String, val name: String? = null, @Json(name = "jobNumber") val jobNumber: String? = null)
data class Admin(val id: String, val username: String, val name: String, val role: String)
data class AttendanceRecord(val id: String, val employeeId: String, val type: String, val timestamp: String, val lat: Double? = null, val lng: Double? = null)
data class AttendanceChallengeRequest(val type: String, val lat: Double, val lng: Double, val qrCode: String, val deviceId: String? = null)
data class AttendanceChallengeResponse(val ok: Boolean, val challengeId: String, val expiresAt: String)
data class AttendanceCreateRequest(val employeeId: String, val type: String, val timestamp: String, val lat: Double, val lng: Double, val challengeId: String)
data class AttendanceCreateResponse(val ok: Boolean)
data class EmployeeRequest(val id: String, val employeeId: String, val employeeName: String? = null, val jobNumber: String? = null, val type: String, val reason: String? = null, val status: String, val createdAt: String, val startDate: String? = null, val endDate: String? = null)
data class CreateRequestBody(val employeeId: String, val employeeName: String, val jobNumber: String, val type: String, val reason: String? = null, val startDate: String? = null, val endDate: String? = null)
data class AppNotification(val id: String, val title: String, val body: String? = null, val message: String? = null, val type: String = "info", val read: Boolean = false, val createdAt: String)
data class NotificationListResponse(val notifications: List<AppNotification> = emptyList())
data class RequestStatusBody(val status: String)

interface HadirApi {
    @POST("api/auth/login") suspend fun login(@Body request: LoginRequest): LoginResponse<Employee>
    @POST("api/auth/login") suspend fun loginAdmin(@Body request: AdminLoginRequest): LoginResponse<Admin>
    @GET("api/me") suspend fun me(): Map<String, Any?>
    @GET("api/attendance") suspend fun attendance(@Query("limit") limit: Int = 200): List<AttendanceRecord>
    @POST("api/attendance/challenge") suspend fun challenge(@Body request: AttendanceChallengeRequest): AttendanceChallengeResponse
    @POST("api/attendance") suspend fun createAttendance(@Body request: AttendanceCreateRequest): AttendanceCreateResponse
    @GET("api/requests") suspend fun requests(): List<EmployeeRequest>
    @POST("api/requests") suspend fun createRequest(@Body request: CreateRequestBody): Map<String, Any?>
    @PATCH("api/requests/{id}") suspend fun updateRequest(@Path("id") id: String, @Body body: RequestStatusBody): Map<String, Any?>
    @GET("api/notifications") suspend fun notifications(): List<AppNotification>
    @GET("api/employees") suspend fun employees(): List<Map<String, Any?>>
    @GET("api/audit") suspend fun audit(@Query("limit") limit: Int = 200): List<Map<String, Any?>>
    @GET("api/locations") suspend fun locations(): List<Map<String, Any?>>
}
