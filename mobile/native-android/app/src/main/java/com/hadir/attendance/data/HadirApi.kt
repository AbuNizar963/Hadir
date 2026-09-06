package com.hadir.attendance.data

import com.squareup.moshi.Json
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

const val HADIR_API = "https://hadir-api.abunizar963.workers.dev/"

data class LoginRequest(val username: String, val password: String, val deviceId: String, val deviceLabel: String, val deviceFingerprint: String)
data class LoginResponse<T>(val token: String, val user: T, val kind: String)
data class Employee(val id: String, val name: String? = null, @Json(name = "jobNumber") val jobNumber: String? = null)
data class AttendanceRecord(val id: String, val employeeId: String, val type: String, val timestamp: String, val lat: Double? = null, val lng: Double? = null)
data class AttendanceChallengeRequest(val type: String, val lat: Double, val lng: Double, val qrCode: String, val deviceId: String? = null)
data class AttendanceChallengeResponse(val ok: Boolean, val challengeId: String, val expiresAt: String)
data class AttendanceCreateRequest(val employeeId: String, val type: String, val timestamp: String, val lat: Double, val lng: Double, val challengeId: String)
data class AttendanceCreateResponse(val ok: Boolean)
data class EmployeeRequest(val id: String, val employeeId: String, val employeeName: String? = null, val jobNumber: String? = null, val type: String, val reason: String? = null, val status: String, val createdAt: String, val startDate: String? = null, val endDate: String? = null)
data class CreateRequestBody(val employeeId: String, val employeeName: String, val jobNumber: String, val type: String, val reason: String? = null, val startDate: String? = null, val endDate: String? = null)

interface HadirApi {
    @POST("api/auth/login") suspend fun login(@Body request: LoginRequest): LoginResponse<Employee>
    @GET("api/me") suspend fun me(): Map<String, Any?>
    @GET("api/attendance?limit=200") suspend fun attendance(): List<AttendanceRecord>
    @POST("api/attendance/challenge") suspend fun challenge(@Body request: AttendanceChallengeRequest): AttendanceChallengeResponse
    @POST("api/attendance") suspend fun createAttendance(@Body request: AttendanceCreateRequest): AttendanceCreateResponse
    @GET("api/requests") suspend fun requests(): List<EmployeeRequest>
    @POST("api/requests") suspend fun createRequest(@Body request: CreateRequestBody): Map<String, Any?>
}
