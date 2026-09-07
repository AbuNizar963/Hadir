package com.hadir.attendance.data

import android.content.Context
import android.provider.Settings
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONObject
import retrofit2.HttpException
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.util.UUID

class SessionStore(context: Context) {
    private val appContext = context.applicationContext
    private val prefs = appContext.getSharedPreferences("hadir_native", Context.MODE_PRIVATE)
    var token: String? get() = prefs.getString("token", null); set(value) { prefs.edit().putString("token", value).apply() }
    var role: String? get() = prefs.getString("role", null); set(value) { prefs.edit().putString("role", value).apply() }
    val deviceId: String get() { val existing = prefs.getString("device_id", null); if (existing != null) return existing; val androidId = Settings.Secure.getString(appContext.contentResolver, Settings.Secure.ANDROID_ID); val value = androidId?.takeIf { it.isNotBlank() } ?: UUID.randomUUID().toString(); prefs.edit().putString("device_id", value).apply(); return value }
}

class BearerInterceptor(private val session: SessionStore) : Interceptor { override fun intercept(chain: Interceptor.Chain): Response = chain.proceed(chain.request().newBuilder().apply { session.token?.let { header("Authorization", "Bearer $it") }; header("X-Device-ID", session.deviceId) }.build()) }

class HadirRepository(context: Context) {
    private val session = SessionStore(context)
    private val httpClient = OkHttpClient.Builder().addInterceptor(BearerInterceptor(session)).build()
    private val moshi = Moshi.Builder().add(KotlinJsonAdapterFactory()).build()
    private val api = Retrofit.Builder().baseUrl(HADIR_API).client(httpClient).addConverterFactory(MoshiConverterFactory.create(moshi)).build().create(HadirApi::class.java)
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()
    fun savedRole(): String? = session.role?.takeIf { !session.token.isNullOrBlank() }
    private fun authBody(username: String, password: String, deviceId: String? = null, deviceLabel: String? = null, fingerprint: String? = null): RequestBody { val json = JSONObject().put("username", username.trim()).put("password", password); if (!deviceId.isNullOrBlank()) json.put("deviceId", deviceId.trim()); if (!deviceLabel.isNullOrBlank()) json.put("deviceLabel", deviceLabel.trim()); if (!fingerprint.isNullOrBlank()) json.put("deviceFingerprint", fingerprint.trim()); return json.toString().toRequestBody(jsonMediaType) }
    private fun authRequest(body: RequestBody): Request = Request.Builder().url("${HADIR_API}api/auth/login").header("Accept", "application/json").header("Content-Type", "application/json; charset=utf-8").header("X-Device-ID", session.deviceId).post(body).build()
    private fun parseAuthResponse(response: okhttp3.Response, expectedKind: String): LoginResponse<JSONObject> { val raw = response.body?.string().orEmpty(); val json = runCatching { JSONObject(raw) }.getOrElse { throw IllegalStateException("استجابة غير صالحة من الخادم (${response.code})", it) }; if (!response.isSuccessful) { val message = json.optString("error").takeIf { it.isNotBlank() }; throw IllegalStateException(message ?: "خطأ من الخادم (${response.code})") }; val token = json.optString("token").trim(); val kind = json.optString("kind").trim(); val user = json.optJSONObject("user"); if (token.isBlank() || user == null) throw IllegalStateException("استجابة تسجيل الدخول ناقصة من الخادم"); if (kind != expectedKind) throw IllegalStateException(if (expectedKind == "admin") "هذا الحساب ليس حساب إدارة" else "هذا الحساب ليس حساب موظف"); return LoginResponse(token, user, kind) }
    private fun adminFromJson(user: JSONObject): Admin = Admin(user.optString("id"), user.optString("username"), user.optString("name"), user.optString("role"))
    private fun employeeFromJson(user: JSONObject): Employee = Employee(user.optString("id"), user.optString("name").takeIf { it.isNotBlank() }, user.optString("jobNumber").takeIf { it.isNotBlank() }, user.optString("status").takeIf { it.isNotBlank() }, user.optString("role").takeIf { it.isNotBlank() }, user.optString("scheduleType").takeIf { it.isNotBlank() }, user.optString("rotationStartDate").takeIf { it.isNotBlank() }, user.optString("workStartTime").takeIf { it.isNotBlank() }, user.optString("workEndTime").takeIf { it.isNotBlank() }, user.optInt("gracePeriodMinutes", 0).takeIf { user.has("gracePeriodMinutes") }, user.optString("locationId").takeIf { it.isNotBlank() })
    suspend fun restoreEmployee(): Employee? = withContext(Dispatchers.IO) { if (session.role != "employee" || session.token.isNullOrBlank()) return@withContext null; try { employeeFromJson(JSONObject(api.me())) } catch (_: Exception) { logout(); null } }
    suspend fun restoreAdmin(): Admin? = withContext(Dispatchers.IO) { if (session.role != "admin" || session.token.isNullOrBlank()) return@withContext null; try { adminFromJson(JSONObject(api.me())) } catch (_: Exception) { logout(); null } }
    suspend fun login(username: String, password: String): Employee = withContext(Dispatchers.IO) { val normalizedUsername = username.trim(); if (normalizedUsername.isBlank() || password.isBlank()) throw IllegalArgumentException("اسم المستخدم وكلمة المرور مطلوبان"); try { val response = httpClient.newCall(authRequest(authBody(normalizedUsername, password, session.deviceId, "Android", session.deviceId))).execute(); val parsed = parseAuthResponse(response, "employee"); session.token = parsed.token; session.role = "employee"; employeeFromJson(parsed.user) } catch (error: IllegalStateException) { if (error.message?.contains("400") == true || error.message?.contains("401") == true) { val response = httpClient.newCall(authRequest(authBody(normalizedUsername, password, session.deviceId, "Android"))).execute(); val parsed = parseAuthResponse(response, "employee"); session.token = parsed.token; session.role = "employee"; employeeFromJson(parsed.user) } else throw error } }
    suspend fun loginAdmin(username: String, password: String): Admin = withContext(Dispatchers.IO) { val normalizedUsername = username.trim(); if (normalizedUsername.isBlank() || password.isBlank()) throw IllegalArgumentException("اسم المستخدم وكلمة المرور مطلوبان"); val response = httpClient.newCall(authRequest(authBody(normalizedUsername, password))).execute(); val parsed = parseAuthResponse(response, "admin"); session.token = parsed.token; session.role = "admin"; adminFromJson(parsed.user) }
    suspend fun me(): Map<String, Any?> = withContext(Dispatchers.IO) { api.me() }
    suspend fun attendance(limit: Int = 200): List<AttendanceRecord> = withContext(Dispatchers.IO) { if (session.role == "admin") api.audit(limit).asSequence().filter { row -> row["result"] == "success" && (row["action"] == "check-in" || row["action"] == "check-out") && row["employeeId"] != null }.map { row -> AttendanceRecord(row["id"].toString(), row["employeeId"].toString(), row["action"].toString(), row["timestamp"].toString(), (row["lat"] as? Number)?.toDouble(), (row["lng"] as? Number)?.toDouble()) }.toList() } else api.attendance(limit) }
    suspend fun requests(): List<EmployeeRequest> = withContext(Dispatchers.IO) { api.requests() }
    suspend fun notifications(): List<AppNotification> = withContext(Dispatchers.IO) { api.notifications() }
    suspend fun employees(): List<Map<String, Any?>> = withContext(Dispatchers.IO) { api.employees() }
    suspend fun audit(limit: Int = 200): List<Map<String, Any?>> = withContext(Dispatchers.IO) { api.audit(limit) }
    suspend fun locations(): List<Map<String, Any?>> = withContext(Dispatchers.IO) { api.locations() }
    suspend fun markNotificationRead(id: String? = null) = withContext(Dispatchers.IO) { api.markNotificationRead(NotificationReadBody(id)) }
    suspend fun updateRequest(id: String, status: String) = withContext(Dispatchers.IO) { api.updateRequest(id, RequestStatusBody(status)) }
    suspend fun createRequest(employee: Employee, type: String, reason: String, startDate: String?, endDate: String?) = withContext(Dispatchers.IO) { api.createRequest(CreateRequestBody(employee.id, employee.name.orEmpty(), employee.jobNumber.orEmpty(), type, reason.ifBlank { null }, startDate, endDate)) }
    suspend fun createChallenge(type: String, lat: Double, lng: Double, qrCode: String): AttendanceChallengeResponse = withContext(Dispatchers.IO) { try { val response = api.challenge(AttendanceChallengeRequest(type, lat, lng, qrCode, session.deviceId)); if (!response.ok) throw IllegalStateException(response.error ?: response.message ?: "فشل التحقق من الموقع. أنت خارج الموقع أو أن رمز QR غير صالح."); response } catch (error: HttpException) { throw errorWithServerMessage(error) } }
    suspend fun createAttendance(employeeId: String, type: String, timestamp: String, lat: Double, lng: Double, challengeId: String) = withContext(Dispatchers.IO) { api.createAttendance(AttendanceCreateRequest(employeeId, type, timestamp, lat, lng, challengeId)) }
    fun logout() { session.token = null; session.role = null }
    private fun errorWithServerMessage(error: HttpException): Exception { val body = runCatching { error.response()?.errorBody()?.string() }.getOrNull().orEmpty(); val json = runCatching { JSONObject(body) }.getOrNull(); val serverMessage = json?.optString("error")?.takeIf { it.isNotBlank() } ?: json?.optString("message")?.takeIf { it.isNotBlank() }; return IllegalStateException(serverMessage ?: "خطأ من الخادم (${error.code()})", error) }
}
