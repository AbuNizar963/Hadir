package com.hadir.attendance.ui

import android.Manifest
import android.app.Application
import android.content.pm.PackageManager
import android.location.Location
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewModelScope
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import com.hadir.attendance.data.AttendanceRecord
import com.hadir.attendance.data.Employee
import com.hadir.attendance.data.EmployeeRequest
import com.hadir.attendance.data.HadirRepository
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import java.text.SimpleDateFormat
import java.time.Duration
import java.time.Instant
import java.util.Date
import java.util.Locale
import kotlin.coroutines.resume

class NativeMainViewModel(application: Application) : AndroidViewModel(application) {
    private val repo = HadirRepository(application)
    private val fused = LocationServices.getFusedLocationProviderClient(application)
    var employee by mutableStateOf<Employee?>(null); private set
    var attendance by mutableStateOf<List<AttendanceRecord>>(emptyList()); private set
    var requests by mutableStateOf<List<EmployeeRequest>>(emptyList()); private set
    var loading by mutableStateOf(false); private set
    var working by mutableStateOf(false); private set
    var error by mutableStateOf<String?>(null); private set

    fun restoreSession() {
        if (loading || employee != null) return
        loading = true; error = null
        viewModelScope.launch {
            try { employee = repo.restoreEmployee(); if (employee != null) refresh() }
            catch (e: Exception) { error = e.message ?: "تعذر استعادة الجلسة" }
            finally { loading = false }
        }
    }

    fun login(username: String, password: String) {
        loading = true; error = null
        viewModelScope.launch {
            try { employee = repo.login(username.trim(), password); refresh() }
            catch (e: Exception) { error = e.message ?: "تعذر تسجيل الدخول" }
            finally { loading = false }
        }
    }
    fun refresh() { viewModelScope.launch { try { attendance = repo.attendance(); requests = repo.requests() } catch (e: Exception) { error = e.message } } }
    fun refreshRequests() { viewModelScope.launch { try { requests = repo.requests() } catch (e: Exception) { error = e.message ?: "تعذر تحديث الطلبات" } } }
    fun clock(type: String, qr: String, locationAllowed: Boolean) {
        val e = employee ?: return
        if (working) return
        working = true; error = null
        viewModelScope.launch {
            try {
                if (!locationAllowed) error("اسمح للموقع أولًا.")
                else {
                    val location = currentLocation() ?: error("تعذر الحصول على موقعك الحالي.")
                    val challenge = repo.createChallenge(type, location.latitude, location.longitude, qr)
                    if (!challenge.ok) error("تعذر التحقق من رمز الموقع.")
                    repo.createAttendance(e.id, type, SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.US).format(Date()), location.latitude, location.longitude, challenge.challengeId)
                    attendance = repo.attendance()
                }
            } catch (x: Exception) { error = x.message ?: "تعذر تسجيل الحضور" }
            finally { working = false }
        }
    }
    fun addRequest(type: String, reason: String, start: String, end: String) {
        val e = employee ?: return
        viewModelScope.launch {
            try { repo.createRequest(e, type, reason, start.ifBlank { null }, end.ifBlank { null }); requests = repo.requests() }
            catch (x: Exception) { error = x.message ?: "تعذر إرسال الطلب" }
        }
    }
    fun logout() { repo.logout(); employee = null; attendance = emptyList(); requests = emptyList() }
    private suspend fun currentLocation(): Location? = suspendCancellableCoroutine { c ->
        val source = CancellationTokenSource(); c.invokeOnCancellation { source.cancel() }
        fused.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, source.token).addOnSuccessListener { c.resume(it) }.addOnFailureListener { c.resume(null) }
    }
}

@Composable
fun NativeMainApp(
    vm: NativeMainViewModel = viewModel(),
    onEmployeeAuthenticated: () -> Unit = {},
    onEmployeeLoggedOut: () -> Unit = {}
) {
    var wasAuthenticated by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { vm.restoreSession() }
    LaunchedEffect(vm.employee) {
        if (vm.employee != null) {
            wasAuthenticated = true
            onEmployeeAuthenticated()
        } else if (wasAuthenticated) {
            wasAuthenticated = false
            onEmployeeLoggedOut()
        }
    }
    if (vm.employee == null) NativeLogin(vm) else NativeShell(vm)
}

@Composable
private fun NativeLogin(vm: NativeMainViewModel) {
    var user by remember { mutableStateOf("") }
    var pass by remember { mutableStateOf("") }
    Scaffold { p ->
        Box(Modifier.fillMaxSize().padding(p).padding(20.dp), contentAlignment = Alignment.Center) {
            Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(28.dp)) {
                Column(Modifier.padding(24.dp)) {
                    Brand()
                    Text("مرحبًا بك في حاضر", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 18.dp))
                    Text("تطبيق الموظف المتكامل للحضور وإدارة يوم العمل", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 6.dp, bottom = 22.dp))
                    OutlinedTextField(value = user, onValueChange = { user = it }, modifier = Modifier.fillMaxWidth(), label = { Text("رقم الموظف") }, singleLine = true)
                    OutlinedTextField(value = pass, onValueChange = { pass = it }, modifier = Modifier.fillMaxWidth().padding(top = 12.dp), label = { Text("الرمز / كلمة المرور") }, singleLine = true)
                    vm.error?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 10.dp)) }
                    Button(onClick = { vm.login(user, pass) }, enabled = user.isNotBlank() && pass.isNotBlank() && !vm.loading, modifier = Modifier.fillMaxWidth().padding(top = 18.dp).height(52.dp), shape = RoundedCornerShape(16.dp)) { Text(if (vm.loading) "جارٍ الدخول…" else "دخول", fontWeight = FontWeight.Bold) }
                }
            }
        }
    }
}

@Composable
private fun NativeShell(vm: NativeMainViewModel) {
    val context = androidx.compose.ui.platform.LocalContext.current
    var tab by remember { mutableIntStateOf(0) }
    var scanner by remember { mutableStateOf(false) }
    var requestDialog by remember { mutableStateOf(false) }
    var requestType by remember { mutableStateOf("permission") }
    var requestReason by remember { mutableStateOf("") }
    var requestStart by remember { mutableStateOf("") }
    var requestEnd by remember { mutableStateOf("") }
    var pendingType by remember { mutableStateOf("check-in") }
    val locationAllowed = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    val cameraAllowed = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { }
    LaunchedEffect(Unit) { val missing = listOf(Manifest.permission.CAMERA, Manifest.permission.ACCESS_FINE_LOCATION).filter { ContextCompat.checkSelfPermission(context, it) != PackageManager.PERMISSION_GRANTED }; if (missing.isNotEmpty()) permissionLauncher.launch(missing.toTypedArray()); vm.refresh() }
    LaunchedEffect(tab) { if (tab == 3) vm.refreshRequests() }
    if (scanner) { QrScanner(onResult = { code -> scanner = false; vm.clock(pendingType, code, true) }, onCancel = { scanner = false }); return }
    if (requestDialog) AlertDialog(onDismissRequest = { requestDialog = false }, title = { Text("طلب جديد") }, text = { Column(verticalArrangement = Arrangement.spacedBy(10.dp)) { Text("اختر نوع الطلب"); Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) { listOf("permission" to "استئذان", "leave" to "إجازة", "checkout" to "انصراف").forEach { (id, label) -> FilterChip(selected = requestType == id, onClick = { requestType = id }, label = { Text(label) }) } }; OutlinedTextField(value = requestReason, onValueChange = { requestReason = it }, modifier = Modifier.fillMaxWidth(), label = { Text("السبب") }, minLines = 2); OutlinedTextField(value = requestStart, onValueChange = { requestStart = it }, modifier = Modifier.fillMaxWidth(), label = { Text("تاريخ البداية (اختياري)") }, singleLine = true); OutlinedTextField(value = requestEnd, onValueChange = { requestEnd = it }, modifier = Modifier.fillMaxWidth(), label = { Text("تاريخ النهاية (اختياري)") }, singleLine = true) } }, confirmButton = { Button(onClick = { vm.addRequest(requestType, requestReason, requestStart, requestEnd); requestDialog = false; requestReason = ""; requestStart = ""; requestEnd = "" }) { Text("إرسال") } }, dismissButton = { TextButton(onClick = { requestDialog = false }) { Text("إلغاء") } })
    Scaffold(bottomBar = { NavigationBar { listOf("الرئيسية" to Icons.Default.Home, "ساعاتي" to Icons.Default.CalendarMonth, "مركزي" to Icons.Default.Badge, "الطلبات" to Icons.Default.ListAlt, "حسابي" to Icons.Default.Person).forEachIndexed { i, pair -> NavigationBarItem(selected = tab == i, onClick = { tab = i }, icon = { Icon(pair.second, null) }, label = { Text(pair.first) }) } } }) { p ->
        when (tab) {
            0 -> HomeTab(vm, p, locationAllowed) { pendingType = it; if (!locationAllowed || !cameraAllowed) permissionLauncher.launch(arrayOf(Manifest.permission.CAMERA, Manifest.permission.ACCESS_FINE_LOCATION)) else scanner = true }
            1 -> HoursTab(vm, p)
            2 -> CenterTab(vm, p)
            3 -> RequestsTab(vm, p) { requestDialog = true }
            else -> AccountTab(vm, p)
        }
    }
}

@Composable private fun HomeTab(vm: NativeMainViewModel, p: PaddingValues, locationAllowed: Boolean, startClock: (String) -> Unit) {
    val latest = vm.attendance.maxByOrNull { it.timestamp }
    val checked = latest?.type == "check-in"
    val today = SimpleDateFormat("EEEE، d MMMM", Locale("ar")).format(Date())
    val employee = vm.employee
    val schedule = scheduleText(employee?.workStartTime, employee?.workEndTime)
    val scheduleLocation = employee?.locationId?.takeIf { it.isNotBlank() }?.let { "الموقع المرتبط بالدوام: $it" } ?: "الموقع المخصص"
    LazyColumn(Modifier.fillMaxSize().padding(p), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item { Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) { Avatar(vm.employee?.name); Spacer(Modifier.width(12.dp)); Column { Text("مرحبًا ${vm.employee?.name.orEmpty()}", fontSize = 19.sp, fontWeight = FontWeight.Bold); Text(today, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp) } } }
        item { Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(26.dp)) { Column(Modifier.padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) { Text(if (checked) "أنت تعمل الآن" else "ساعة العمل", color = MaterialTheme.colorScheme.onSurfaceVariant); Text(if (checked) "مسجّل حضور" else "جاهز للتسجيل", fontSize = 22.sp, fontWeight = FontWeight.Bold); Spacer(Modifier.height(18.dp)); Button(onClick = { startClock(if (checked) "check-out" else "check-in") }, enabled = !vm.working, modifier = Modifier.size(170.dp), shape = CircleShape) { Column(horizontalAlignment = Alignment.CenterHorizontally) { Text(if (checked) "انصراف" else "حضور", fontSize = 24.sp, fontWeight = FontWeight.Bold); Text(if (vm.working) "جارٍ التحقق…" else "QR + GPS", fontSize = 11.sp) } }; if (!locationAllowed) Text("فعّل الموقع لتنفيذ تسجيل الحضور.", color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 12.dp), textAlign = TextAlign.Center); vm.error?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 8.dp), textAlign = TextAlign.Center) } } } }
        item { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) { Metric("سجلات", vm.attendance.size, Modifier.weight(1f)); Metric("طلبات", vm.requests.count { it.status == "pending" }, Modifier.weight(1f)) } }
        item { SectionCard("جدول اليوم", schedule, scheduleLocation) }
        item { Text("آخر النشاطات", fontWeight = FontWeight.Bold, fontSize = 18.sp) }
        items(vm.attendance.sortedByDescending { it.timestamp }.take(5)) { ActivityItem(it) }
    }
}

@Composable private fun HoursTab(vm: NativeMainViewModel, p: PaddingValues) {
    val grouped = vm.attendance.groupBy { it.timestamp.take(10) }.toList().sortedByDescending { it.first }
    LazyColumn(Modifier.fillMaxSize().padding(p), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { Text("ساعاتي", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Black); Text("سجل الحضور والانصراف اليومي", color = MaterialTheme.colorScheme.onSurfaceVariant) }
        items(grouped) { (day, rows) -> val ins = rows.filter { it.type == "check-in" || it.type == "in" }.minByOrNull { it.timestamp }; val outs = rows.filter { it.type == "check-out" || it.type == "out" }.maxByOrNull { it.timestamp }; Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp)) { Column(Modifier.padding(16.dp)) { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text(day, fontWeight = FontWeight.Bold); Text(if (ins != null && outs != null) "مكتمل" else "مفتوح", color = MaterialTheme.colorScheme.primary) }; Spacer(Modifier.height(8.dp)); Text("الحضور: ${ins?.let { time(it.timestamp) } ?: "—"}"); Text("الانصراف: ${outs?.let { time(it.timestamp) } ?: "—"}"); Text("المدة: ${duration(ins?.timestamp, outs?.timestamp)}", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 5.dp)) } } }
        if (grouped.isEmpty()) item { Empty("لا توجد سجلات حضور بعد") }
    }
}

@Composable private fun CenterTab(vm: NativeMainViewModel, p: PaddingValues) {
    val e = vm.employee
    val schedule = scheduleText(e?.workStartTime, e?.workEndTime)
    LazyColumn(Modifier.fillMaxSize().padding(p), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Text("مركز الموظف", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Black); Text("بطاقتك وملخص التزامك", color = MaterialTheme.colorScheme.onSurfaceVariant) }
        item { Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(24.dp)) { Column(Modifier.padding(20.dp)) { Row(verticalAlignment = Alignment.CenterVertically) { Avatar(e?.name); Spacer(Modifier.width(14.dp)); Column { Text(e?.name.orEmpty(), fontSize = 21.sp, fontWeight = FontWeight.Black); Text("الرقم الوظيفي: ${e?.jobNumber.orEmpty()}", color = MaterialTheme.colorScheme.onSurfaceVariant) } }; HorizontalDivider(Modifier.padding(vertical = 16.dp)); Info("الحالة", "نشط"); Info("الدوام", schedule); Info("عدد السجلات", vm.attendance.size.toString()) } } }
        item { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) { Metric("حضور", vm.attendance.count { it.type == "check-in" || it.type == "in" }, Modifier.weight(1f)); Metric("انصراف", vm.attendance.count { it.type == "check-out" || it.type == "out" }, Modifier.weight(1f)); Metric("طلبات", vm.requests.size, Modifier.weight(1f)) } }
        item { SectionCard("بطاقة رقمية", "رقم الموظف ${e?.jobNumber.orEmpty()}", "يمكن استخدامها للتعريف داخل نظام حاضر") }
    }
}

@Composable private fun RequestsTab(vm: NativeMainViewModel, p: PaddingValues, add: () -> Unit) {
    var filter by remember { mutableStateOf("all") }
    val filtered = remember(vm.requests, filter) {
        vm.requests
            .asSequence()
            .filter { filter == "all" || it.status.equals(filter, ignoreCase = true) }
            .sortedByDescending { it.createdAt }
            .toList()
    }
    val pending = vm.requests.count { it.status.equals("pending", ignoreCase = true) }
    val approved = vm.requests.count { it.status.equals("approved", ignoreCase = true) || it.status.equals("confirmed", ignoreCase = true) }
    val rejected = vm.requests.count { it.status.equals("rejected", ignoreCase = true) }
    LazyColumn(Modifier.fillMaxSize().padding(p), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("الطلبات", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Black)
                    Text("الإجازات والاستئذانات وطلبات الانصراف", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    IconButton(onClick = vm::refreshRequests) { Icon(Icons.Default.Refresh, contentDescription = "تحديث الطلبات") }
                    Button(onClick = add) { Text("طلب جديد") }
                }
            }
        }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Metric("الكل", vm.requests.size, Modifier.weight(1f))
                Metric("معلقة", pending, Modifier.weight(1f))
                Metric("معتمدة", approved, Modifier.weight(1f))
            }
        }
        item {
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                listOf("all" to "الكل", "pending" to "معلقة", "approved" to "معتمدة", "rejected" to "مرفوضة").forEachIndexed { index, (id, label) ->
                    SegmentedButton(selected = filter == id, onClick = { filter = id }, shape = SegmentedButtonDefaults.itemShape(index, 4)) { Text(label, fontSize = 12.sp) }
                }
            }
        }
        items(filtered) { r ->
            val reason = r.reason.orEmpty().trim()
            val created = r.createdAt.trim()
            Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(18.dp)) {
                Column(Modifier.padding(15.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(requestLabel(r.type), fontWeight = FontWeight.Bold)
                        Text(statusLabel(r.status), color = statusColor(r.status))
                    }
                    if (reason.isNotBlank()) Text(reason, modifier = Modifier.padding(top = 7.dp))
                    Text(if (created.length >= 10) created.take(10) else "—", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp, modifier = Modifier.padding(top = 7.dp))
                }
            }
        }
        if (filtered.isEmpty()) item { Empty(if (vm.requests.isEmpty()) "لا توجد طلبات" else "لا توجد طلبات بهذا التصنيف") }
        if (rejected > 0 && filter == "all") item { Text("المرفوضة: $rejected", color = MaterialTheme.colorScheme.error, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 4.dp)) }
    }
}

@Composable private fun AccountTab(vm: NativeMainViewModel, p: PaddingValues) { Column(Modifier.fillMaxSize().padding(p).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) { Text("حسابي", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Black); Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(22.dp)) { Column(Modifier.padding(18.dp)) { Text(vm.employee?.name.orEmpty(), fontSize = 21.sp, fontWeight = FontWeight.Bold); Text(vm.employee?.jobNumber.orEmpty(), color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 4.dp)); HorizontalDivider(Modifier.padding(vertical = 15.dp)); Text("الأمان والجلسة", fontWeight = FontWeight.Bold); Text("الحضور يستخدم QR + GPS للتحقق قبل التسجيل.", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 5.dp)) } }; Button(onClick = vm::logout, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.errorContainer, contentColor = MaterialTheme.colorScheme.onErrorContainer)) { Text("تسجيل الخروج") } } }

@Composable private fun Avatar(name: String?) { Box(Modifier.size(50.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primaryContainer), contentAlignment = Alignment.Center) { Text(name?.firstOrNull()?.toString() ?: "ح", color = MaterialTheme.colorScheme.primary, fontSize = 21.sp, fontWeight = FontWeight.Black) }
}
@Composable private fun Brand() { Box(Modifier.size(54.dp).clip(RoundedCornerShape(16.dp)).background(MaterialTheme.colorScheme.primary), contentAlignment = Alignment.Center) { Text("ح", color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.Black) }
}
@Composable private fun Metric(label: String, value: Int, modifier: Modifier) { Card(modifier, shape = RoundedCornerShape(18.dp)) { Column(Modifier.padding(15.dp)) { Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp); Text(value.toString(), fontSize = 22.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 4.dp)) } } }
@Composable private fun SectionCard(title: String, a: String, b: String) { Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp)) { Column(Modifier.padding(17.dp)) { Text(title, fontWeight = FontWeight.Bold, fontSize = 17.sp); Text(a, modifier = Modifier.padding(top = 9.dp)); Text(b, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 3.dp)) } } }
@Composable private fun ActivityItem(r: AttendanceRecord) { Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp)) { Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) { Icon(if (r.type == "check-in") Icons.Default.Login else Icons.Default.Logout, null, tint = MaterialTheme.colorScheme.primary); Spacer(Modifier.width(10.dp)); Column { Text(if (r.type == "check-in") "تسجيل حضور" else "تسجيل انصراف", fontWeight = FontWeight.Bold); Text(time(r.timestamp), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp) } } } }
@Composable private fun Info(label: String, value: String) { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant); Text(value, fontWeight = FontWeight.Bold) } }
@Composable private fun Empty(text: String) { Box(Modifier.fillMaxWidth().padding(30.dp), contentAlignment = Alignment.Center) { Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant) } }
private fun scheduleText(start: String?, end: String?): String = if (!start.isNullOrBlank() && !end.isNullOrBlank()) "$start — $end" else "لم يتم تحديد وقت الدوام"
private fun time(v: String) = runCatching { SimpleDateFormat("HH:mm", Locale.US).format(Date.from(Instant.parse(v))) }.getOrElse { v.take(16).takeLast(5) }
private fun duration(a: String?, b: String?): String { if (a == null) return "—"; val end = b ?: Instant.now().toString(); val m = runCatching { Duration.between(Instant.parse(a), Instant.parse(end)).toMinutes() }.getOrDefault(0); return "${m / 60}س ${m % 60}د" }
private fun requestLabel(t: String) = when(t) { "leave" -> "إجازة"; "checkout" -> "انصراف"; else -> "استئذان" }
private fun statusLabel(v: String) = when (v.lowercase(Locale.US)) { "pending" -> "قيد الانتظار"; "approved" -> "مقبول"; "confirmed" -> "مؤكد"; "rejected" -> "مرفوض"; "cancelled", "canceled" -> "ملغى"; else -> v.ifBlank { "غير محدد" } }
@Composable private fun statusColor(s: String) = when(s.lowercase(Locale.US)) { "approved", "confirmed" -> Color(0xFF2E7D32); "rejected" -> MaterialTheme.colorScheme.error; else -> MaterialTheme.colorScheme.primary }
