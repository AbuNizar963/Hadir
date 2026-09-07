package com.hadir.attendance.data

import android.content.Context
import android.provider.Settings
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Response
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.util.UUID

class SessionStore(context: Context) {
    private val appContext = context.applicationContext
    private val prefs = appContext.getSharedPreferences("hadir_native", Context.MODE_PRIVATE)
    var token: String?
        get() = prefs.getString("token", null)
        set(value) { prefs.edit().putString("token", value).apply() }
    val deviceId: String
        get() {
            val existing = prefs.getString("device_id", null)
            if (existing != null) return existing
            val androidId = Settings.Secure.getString(appContext.contentResolver, Settings.Secure.ANDROID_ID)
            val value = androidId?.takeIf { it.isNotBlank() } ?: UUID.randomUUID().toString()
            prefs.edit().putString("device_id", value).apply()
            return value
        }
}

class BearerInterceptor(private val session: SessionStore) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response = chain.proceed(chain.request().newBuilder().apply { session.token?.let { header("Authorization", "Bearer $it") } }.build())
}

class HadirRepository(context: Context) {
    private val session = SessionStore(context)
    private val api = Retrofit.Builder().baseUrl(HADIR_API).client(OkHttpClient.Builder().addInterceptor(BearerInterceptor(session)).build()).addConverterFactory(MoshiConverterFactory.create()).build().create(HadirApi::class.java)

    suspend fun login(username: String, password: String): Employee = withContext(Dispatchers.IO) {
        val response = api.login(LoginRequest(username, password, session.deviceId, "Android", session.deviceId))
        if (response.kind != "employee") error("هذا الحساب ليس حساب موظف")
        session.token = response.token
        response.user
    }
    suspend fun loginAdmin(username: String, password: String): Admin = withContext(Dispatchers.IO) {
        val response = api.loginAdmin(AdminLoginRequest(username, password))
        if (response.kind != "admin") error("هذا الحساب ليس حساب إدارة")
        session.token = response.token
        response.user
    }
    suspend fun attendance(limit: Int = 200): List<AttendanceRecord> = withContext(Dispatchers.IO) { api.attendance(limit) }
    suspend fun requests(): List<EmployeeRequest> = withContext(Dispatchers.IO) { api.requests() }
    suspend fun notifications(): List<AppNotification> = withContext(Dispatchers.IO) { api.notifications() }
    suspend fun employees(): List<Map<String, Any?>> = withContext(Dispatchers.IO) { api.employees() }
    suspend fun audit(limit: Int = 200): List<Map<String, Any?>> = withContext(Dispatchers.IO) { api.audit(limit) }
    suspend fun locations(): List<Map<String, Any?>> = withContext(Dispatchers.IO) { api.locations() }
    suspend fun updateRequest(id: String, status: String) = withContext(Dispatchers.IO) { api.updateRequest(id, RequestStatusBody(status)) }
    suspend fun createRequest(employee: Employee, type: String, reason: String, startDate: String?, endDate: String?) = withContext(Dispatchers.IO) {
        api.createRequest(CreateRequestBody(employee.id, employee.name.orEmpty(), employee.jobNumber.orEmpty(), type, reason.ifBlank { null }, startDate, endDate))
    }
    suspend fun createChallenge(type: String, lat: Double, lng: Double, qrCode: String): AttendanceChallengeResponse = withContext(Dispatchers.IO) { api.challenge(AttendanceChallengeRequest(type, lat, lng, qrCode, session.deviceId)) }
    suspend fun createAttendance(employeeId: String, type: String, timestamp: String, lat: Double, lng: Double, challengeId: String) = withContext(Dispatchers.IO) { api.createAttendance(AttendanceCreateRequest(employeeId, type, timestamp, lat, lng, challengeId)) }
    fun logout() { session.token = null }
}
