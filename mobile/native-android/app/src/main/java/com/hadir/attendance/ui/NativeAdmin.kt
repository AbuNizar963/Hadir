package com.hadir.attendance.ui

import android.app.Application
import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AssignmentTurnedIn
import androidx.compose.material.icons.filled.Badge
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewModelScope
import com.hadir.attendance.data.Admin
import com.hadir.attendance.data.EmployeeRequest
import com.hadir.attendance.data.HadirRepository
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

private val AdminBg = Color(0xFF0C1018)
private val AdminCard = Color(0xFF171C26)
private val AdminPanel = Color(0xFF202631)
private val AdminBorder = Color(0xFF303744)
private val AdminGreen = Color(0xFF35C995)
private val AdminCyan = Color(0xFF35C7F2)
private val AdminAmber = Color(0xFFE9A52D)
private val AdminText = Color(0xFFF0F3F7)
private val AdminMuted = Color(0xFFACB4C1)
private val AdminRed = Color(0xFFE35D6A)

class NativeAdminViewModel(application: Application) : AndroidViewModel(application) {
    private val repo = HadirRepository(application)
    var admin by mutableStateOf<Admin?>(null); private set
    var employees by mutableStateOf<List<Map<String, Any?>>>(emptyList()); private set
    var attendanceCount by mutableIntStateOf(0); private set
    var requests by mutableStateOf<List<EmployeeRequest>>(emptyList()); private set
    var locationsCount by mutableIntStateOf(0); private set
    var audit by mutableStateOf<List<Map<String, Any?>>>(emptyList()); private set
    var loading by mutableStateOf(false); private set
    var error by mutableStateOf<String?>(null); private set

    fun restoreSession() {
        if (loading || admin != null) return
        loading = true; error = null
        viewModelScope.launch {
            try { admin = repo.restoreAdmin(); if (admin != null) refresh() }
            catch (e: Exception) { error = e.message ?: "تعذر استعادة الجلسة" }
            finally { loading = false }
        }
    }

    fun login(username: String, password: String) {
        loading = true; error = null
        viewModelScope.launch {
            try { admin = repo.loginAdmin(username.trim(), password); refresh() }
            catch (e: Exception) { error = e.message ?: "تعذر تسجيل دخول الإدارة" }
            finally { loading = false }
        }
    }

    fun refresh() {
        viewModelScope.launch {
            try {
                val employeesData = repo.employees()
                val attendanceData = repo.attendance(2000)
                val requestsData = repo.requests()
                val locationsData = repo.locations()
                val auditData = repo.audit(300)
                employees = employeesData
                attendanceCount = attendanceData.size
                requests = requestsData
                locationsCount = locationsData.size
                audit = auditData
            } catch (e: Exception) { error = e.message ?: "تعذر تحديث لوحة الإدارة" }
        }
    }

    fun updateRequest(id: String, status: String) {
        viewModelScope.launch {
            try { repo.updateRequest(id, status); refresh() }
            catch (e: Exception) { error = e.message ?: "تعذر تحديث الطلب" }
        }
    }

    fun logout() { repo.logout(); admin = null; employees = emptyList(); requests = emptyList(); audit = emptyList() }
}

@Composable
fun NativeRoleEntry(onEmployee: () -> Unit, onAdmin: () -> Unit) {
    Box(Modifier.fillMaxSize().background(AdminBg), contentAlignment = Alignment.Center) {
        AdminCard {
            Column(Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                AdminBrand()
                Text("حاضر", fontSize = 30.sp, fontWeight = FontWeight.Black, color = AdminText, modifier = Modifier.padding(top = 16.dp))
                Text("اختر مساحة العمل", color = AdminMuted, modifier = Modifier.padding(top = 6.dp, bottom = 24.dp))
                Button(onClick = onEmployee, modifier = Modifier.fillMaxWidth().height(54.dp), shape = RoundedCornerShape(16.dp), colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = AdminGreen, contentColor = AdminBg)) { Text("مساحة الموظف", fontWeight = FontWeight.Black) }
                Spacer(Modifier.height(10.dp))
                TextButton(onClick = onAdmin, modifier = Modifier.fillMaxWidth()) { Text("دخول المدير / المشرف", color = AdminCyan) }
            }
        }
    }
}

@Composable
fun NativeAdminApp(vm: NativeAdminViewModel = viewModel(), onBack: () -> Unit) {
    LaunchedEffect(Unit) { vm.restoreSession() }
    if (vm.admin == null) NativeAdminLogin(vm, onBack) else NativeAdminShell(vm, onBack)
}

@Composable
private fun NativeAdminLogin(vm: NativeAdminViewModel, onBack: () -> Unit) {
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    AdminSurface {
        Box(Modifier.fillMaxSize().padding(20.dp), contentAlignment = Alignment.Center) {
            AdminCard {
                Column(Modifier.padding(22.dp)) {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f), horizontalAlignment = Alignment.End) {
                            Text("HADIR · ADMIN", color = AdminMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 2.sp)
                            Text("مساحة الإدارة", fontSize = 28.sp, fontWeight = FontWeight.Black, color = AdminText, modifier = Modifier.padding(top = 5.dp), textAlign = TextAlign.Right)
                            Text("للمدير والمالك والمشرف، بصلاحيات الخادم الفعلية.", color = AdminMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 6.dp), textAlign = TextAlign.Right)
                        }
                        AdminBrand(50.dp)
                    }
                    OutlinedTextField(username, { username = it }, Modifier.fillMaxWidth().padding(top = 20.dp), label = { Text("اسم المستخدم") }, singleLine = true)
                    OutlinedTextField(password, { password = it }, Modifier.fillMaxWidth().padding(top = 12.dp), label = { Text("كلمة المرور") }, visualTransformation = PasswordVisualTransformation(), singleLine = true)
                    vm.error?.let { Text(it, color = AdminRed, modifier = Modifier.padding(top = 10.dp)) }
                    Button(onClick = { vm.login(username, password) }, enabled = username.isNotBlank() && password.isNotBlank() && !vm.loading, modifier = Modifier.fillMaxWidth().padding(top = 18.dp).height(52.dp), shape = RoundedCornerShape(16.dp), colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = AdminGreen, contentColor = AdminBg)) { Text(if (vm.loading) "جارٍ الدخول…" else "دخول الإدارة", fontWeight = FontWeight.Black) }
                    TextButton(onClick = onBack, modifier = Modifier.fillMaxWidth().padding(top = 4.dp)) { Text("العودة لاختيار مساحة العمل", color = AdminMuted) }
                }
            }
        }
    }
}

@Composable
private fun NativeAdminShell(vm: NativeAdminViewModel, onBack: () -> Unit) {
    var tab by remember { mutableIntStateOf(0) }
    LaunchedEffect(Unit) { vm.refresh() }
    AdminSurface {
        Scaffold(containerColor = AdminBg, bottomBar = {
            NavigationBar(containerColor = AdminCard, tonalElevation = 0.dp) {
                val items = listOf("الرئيسية" to Icons.Default.Home, "الموظفون" to Icons.Default.People, "الطلبات" to Icons.Default.AssignmentTurnedIn, "التقارير" to Icons.Default.BarChart, "التدقيق" to Icons.Default.Settings)
                items.forEachIndexed { i, item -> NavigationBarItem(selected = tab == i, onClick = { tab = i }, icon = { Icon(item.second, null) }, label = { Text(item.first, fontSize = 9.sp, fontWeight = FontWeight.Bold) }, colors = androidx.compose.material3.NavigationBarItemDefaults.colors(selectedIconColor = AdminGreen, selectedTextColor = AdminGreen, indicatorColor = Color(0xFF12372E), unselectedIconColor = AdminMuted, unselectedTextColor = AdminMuted)) }
            }
        }) { p ->
            when (tab) {
                0 -> AdminDashboard(vm, p)
                1 -> AdminEmployees(vm, p)
                2 -> AdminRequests(vm, p)
                3 -> AdminReports(vm, p)
                else -> AdminAudit(vm, p)
            }
        }
    }
}

@Composable
private fun AdminHeader(title: String, subtitle: String, logout: (() -> Unit)? = null) {
    Row(Modifier.fillMaxWidth().padding(start = 14.dp, end = 14.dp, top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f), horizontalAlignment = Alignment.End) {
            Text("HADIR · ADMIN", color = AdminMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 2.sp, textAlign = TextAlign.Right)
            Text(title, color = AdminText, fontSize = 30.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 4.dp), textAlign = TextAlign.Right)
            Text(subtitle, color = AdminMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp), textAlign = TextAlign.Right)
        }
        logout?.let { IconButton(onClick = it) { Icon(Icons.Default.Logout, "تسجيل الخروج", tint = AdminMuted) } }
    }
}

@Composable
private fun AdminDashboard(vm: NativeAdminViewModel, p: PaddingValues) {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 14.dp, end = 14.dp, bottom = 22.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { AdminHeader("لوحة القيادة", "نظرة مباشرة على حالة النظام والقوى العاملة", vm::logout) }
        item {
            AdminCard {
                Column(Modifier.padding(18.dp)) {
                    Text("الحالة التشغيلية الحالية", color = AdminMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Right, modifier = Modifier.fillMaxWidth())
                    Text("مركز التحكم في حاضر", color = AdminText, fontSize = 25.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 4.dp).fillMaxWidth(), textAlign = TextAlign.Right)
                    Text("بيانات مباشرة من HADIR API", color = AdminMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 5.dp).fillMaxWidth(), textAlign = TextAlign.Right)
                    Row(Modifier.fillMaxWidth().padding(top = 16.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) { AdminMetric("الموظفون", vm.employees.size, AdminGreen, Modifier.weight(1f)); AdminMetric("الحضور", vm.attendanceCount, AdminCyan, Modifier.weight(1f)) }
                    Row(Modifier.fillMaxWidth().padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) { AdminMetric("الطلبات", vm.requests.size, AdminAmber, Modifier.weight(1f)); AdminMetric("المواقع", vm.locationsCount, AdminCyan, Modifier.weight(1f)) }
                }
            }
        }
        vm.error?.let { msg -> item { AdminError(msg) } }
        item { Text("التشغيل", color = AdminText, fontSize = 19.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 4.dp).fillMaxWidth(), textAlign = TextAlign.Right) }
        item { AdminAction(Icons.Default.Groups, "القوى العاملة", "${vm.employees.size} موظفًا في النظام", AdminGreen) }
        item { AdminAction(Icons.Default.Place, "مواقع العمل", "${vm.locationsCount} موقعًا متاحًا للعمليات", AdminCyan) }
        item { AdminAction(Icons.Default.Badge, "صلاحية الإدارة", "${vm.admin?.role.orEmpty()} — الصلاحيات يحددها الخادم", AdminAmber) }
    }
}

@Composable
private fun AdminEmployees(vm: NativeAdminViewModel, p: PaddingValues) {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 14.dp, end = 14.dp, bottom = 22.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { AdminHeader("الموظفون", "إدارة ومراجعة بيانات القوى العاملة") }
        vm.error?.let { msg -> item { AdminError(msg) } }
        items(vm.employees) { e ->
            val name = "${e["name"] ?: "بدون اسم"}"
            val job = "${e["jobNumber"] ?: "—"}"
            val status = "${e["status"] ?: "—"}"
            AdminEmployeeRow(name, job, status)
        }
        if (vm.employees.isEmpty()) item { AdminEmpty("لا توجد بيانات موظفين.") }
    }
}

@Composable
private fun AdminRequests(vm: NativeAdminViewModel, p: PaddingValues) {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 14.dp, end = 14.dp, bottom = 22.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { AdminHeader("إدارة الطلبات", "الموافقة والرفض عبر API بصلاحية الحساب الحالي") }
        vm.error?.let { msg -> item { AdminError(msg) } }
        items(vm.requests.sortedByDescending { it.createdAt }) { r ->
            AdminCard {
                Column(Modifier.padding(16.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text(statusLabel(r.status), color = statusColor(r.status), fontSize = 11.sp, fontWeight = FontWeight.Black, modifier = Modifier.background(statusColor(r.status).copy(alpha = .12f), RoundedCornerShape(20.dp)).padding(horizontal = 9.dp, vertical = 5.dp))
                        Text("${r.employeeName ?: r.employeeId} · ${requestLabel(r.type)}", color = AdminText, fontWeight = FontWeight.Bold, textAlign = TextAlign.Right, modifier = Modifier.weight(1f).padding(start = 10.dp))
                    }
                    if (!r.reason.isNullOrBlank()) Text(r.reason!!, color = AdminMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 9.dp).fillMaxWidth(), textAlign = TextAlign.Right)
                    if (r.status == "pending") Row(modifier = Modifier.fillMaxWidth().padding(top = 12.dp), horizontalArrangement = Arrangement.End) { FilterChip(selected = false, onClick = { vm.updateRequest(r.id, "rejected") }, label = { Text("رفض", fontWeight = FontWeight.Bold) }); Spacer(Modifier.width(8.dp)); FilterChip(selected = false, onClick = { vm.updateRequest(r.id, "approved") }, label = { Text("موافقة", fontWeight = FontWeight.Bold) }) }
                }
            }
        }
        if (vm.requests.isEmpty()) item { AdminEmpty("لا توجد طلبات.") }
    }
}

private data class AdminReportSummary(
    val employeeId: String,
    val name: String,
    val job: String,
    val workDays: Int,
    val present: Int,
    val absent: Int,
    val early: Int,
    val late: Int,
    val open: Int,
    val permission: Int,
    val leave: Int,
    val off: Int,
    val workedMinutes: Int,
    val lateMinutes: Int,
    val earlyMinutes: Int
)

private data class AdminReportDay(
    val date: LocalDate,
    val status: String,
    val checkIn: String,
    val checkOut: String,
    val workedMinutes: Int,
    val lateMinutes: Int,
    val earlyMinutes: Int,
    val detail: String
)

@Composable
private fun AdminReports(vm: NativeAdminViewModel, p: PaddingValues) {
    var mode by remember { mutableStateOf("monthly") }
    var dateText by remember { mutableStateOf(LocalDate.now().toString()) }
    var monthText by remember { mutableStateOf(YearMonth.now().toString()) }
    var yearText by remember { mutableStateOf(LocalDate.now().year.toString()) }
    var expanded by remember { mutableStateOf<String?>(null) }
    val today = LocalDate.now()
    val formatter = remember { DateTimeFormatter.ofPattern("yyyy-MM-dd") }
    val month = runCatching { YearMonth.parse(monthText) }.getOrDefault(YearMonth.now())
    val year = yearText.toIntOrNull() ?: today.year
    val dates = remember(mode, dateText, monthText, yearText, today) {
        when (mode) {
            "daily" -> listOfNotNull(runCatching { LocalDate.parse(dateText) }.getOrNull()).filter { !it.isAfter(today) }
            "annual" -> (1..12).flatMap { m -> (1..YearMonth.of(year, m).lengthOfMonth()).map { d -> LocalDate.of(year, m, d) } }.filter { !it.isAfter(today) }
            else -> (1..month.lengthOfMonth()).map { month.atDay(it) }.filter { !it.isAfter(today) }
        }
    }
    val auditIndex = remember(vm.audit) { buildAdminAuditIndex(vm.audit) }
    val requestRows = remember(vm.requests) { vm.requests }
    val summaries = remember(vm.employees, dates, auditIndex, requestRows) {
        vm.employees.map { employee -> buildAdminSummary(employee, dates, auditIndex, requestRows) }
    }
    val totalWorked = summaries.sumOf { it.workedMinutes }
    val totalLate = summaries.sumOf { it.lateMinutes }
    val totalEarly = summaries.sumOf { it.earlyMinutes }
    val context = LocalContext.current
    val csv = remember(summaries, mode, dateText, monthText, yearText) { buildAdminCsv(summaries, mode, dateText, monthText, yearText) }

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 14.dp, end = 14.dp, bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { AdminHeader("تقارير المدير", "نفس أنماط التقرير الموجودة في الموقع: يومي، شهري، سنوي") }
        item {
            AdminCard {
                Column {
                    Text("نوع التقرير", color = AdminMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Right)
                    Row(Modifier.fillMaxWidth().padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                        FilterChip(selected = mode == "daily", onClick = { mode = "daily" }, label = { Text("يومي") }, modifier = Modifier.weight(1f))
                        FilterChip(selected = mode == "monthly", onClick = { mode = "monthly" }, label = { Text("شهري") }, modifier = Modifier.weight(1f))
                        FilterChip(selected = mode == "annual", onClick = { mode = "annual" }, label = { Text("سنوي") }, modifier = Modifier.weight(1f))
                    }
                    when (mode) {
                        "daily" -> OutlinedTextField(dateText, { dateText = it }, Modifier.fillMaxWidth().padding(top = 10.dp), label = { Text("التاريخ yyyy-MM-dd") }, singleLine = true)
                        "monthly" -> OutlinedTextField(monthText, { monthText = it }, Modifier.fillMaxWidth().padding(top = 10.dp), label = { Text("الشهر yyyy-MM") }, singleLine = true)
                        else -> OutlinedTextField(yearText, { yearText = it.filter(Char::isDigit).take(4) }, Modifier.fillMaxWidth().padding(top = 10.dp), label = { Text("السنة yyyy") }, singleLine = true)
                    }
                    Text("${dates.size} يومًا ضمن الفترة · ${vm.employees.size} موظفًا", color = AdminMuted, fontSize = 11.sp, modifier = Modifier.padding(top = 8.dp).fillMaxWidth(), textAlign = TextAlign.Right)
                    Button(onClick = { context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply { type = "text/csv"; putExtra(Intent.EXTRA_SUBJECT, "تقرير حضور حاضر"); putExtra(Intent.EXTRA_TEXT, csv) }, "تصدير التقرير")) }, modifier = Modifier.fillMaxWidth().padding(top = 10.dp), shape = RoundedCornerShape(14.dp), colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = AdminCyan, contentColor = AdminBg)) { Text("تصدير التقرير CSV", fontWeight = FontWeight.Black) }
                }
            }
        }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                AdminMetric("الحضور", summaries.sumOf { it.present }, AdminGreen, Modifier.weight(1f))
                AdminMetric("الغياب", summaries.sumOf { it.absent }, AdminRed, Modifier.weight(1f))
            }
        }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                AdminMetric("التأخير", summaries.sumOf { it.late }, AdminAmber, Modifier.weight(1f))
                AdminMetric("المفتوح", summaries.sumOf { it.open }, AdminCyan, Modifier.weight(1f))
            }
        }
        item {
            AdminCard {
                Column {
                    Text("ملخص الفترة", color = AdminText, fontSize = 18.sp, fontWeight = FontWeight.Black, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Right)
                    Text("ساعات العمل: ${formatAdminMinutes(totalWorked)}", color = AdminText, modifier = Modifier.padding(top = 8.dp).fillMaxWidth(), textAlign = TextAlign.Right)
                    Text("دقائق التأخير: ${formatAdminMinutes(totalLate)}", color = AdminAmber, modifier = Modifier.padding(top = 3.dp).fillMaxWidth(), textAlign = TextAlign.Right)
                    Text("دقائق الانصراف المبكر: ${formatAdminMinutes(totalEarly)}", color = AdminRed, modifier = Modifier.padding(top = 3.dp).fillMaxWidth(), textAlign = TextAlign.Right)
                    Text("استئذان: ${summaries.sumOf { it.permission }} · إجازة: ${summaries.sumOf { it.leave }} · راحة/عطلة: ${summaries.sumOf { it.off }}", color = AdminMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 5.dp).fillMaxWidth(), textAlign = TextAlign.Right)
                }
            }
        }
        item { Text("ملخص الموظفين", color = AdminText, fontSize = 19.sp, fontWeight = FontWeight.Black, modifier = Modifier.fillMaxWidth().padding(top = 4.dp), textAlign = TextAlign.Right) }
        items(summaries) { s ->
            AdminCard {
                Column {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Text("${s.present} حاضر · ${s.absent} غياب", color = AdminGreen, fontSize = 11.sp, fontWeight = FontWeight.Black)
                        Column(Modifier.weight(1f), horizontalAlignment = Alignment.End) {
                            Text(s.name, color = AdminText, fontWeight = FontWeight.Black, textAlign = TextAlign.Right)
                            Text("${s.job} · أيام العمل ${s.workDays}", color = AdminMuted, fontSize = 11.sp, textAlign = TextAlign.Right)
                        }
                    }
                    Text("متأخر ${s.late} · مبكر ${s.early} · تسجيل ناقص ${s.open}", color = AdminMuted, fontSize = 11.sp, modifier = Modifier.padding(top = 7.dp).fillMaxWidth(), textAlign = TextAlign.Right)
                    Text("عمل ${formatAdminMinutes(s.workedMinutes)} · تأخير ${formatAdminMinutes(s.lateMinutes)} · مبكر ${formatAdminMinutes(s.earlyMinutes)}", color = AdminText, fontSize = 11.sp, modifier = Modifier.padding(top = 3.dp).fillMaxWidth(), textAlign = TextAlign.Right)
                    TextButton(onClick = { expanded = if (expanded == s.employeeId) null else s.employeeId }, modifier = Modifier.fillMaxWidth()) { Text(if (expanded == s.employeeId) "إخفاء التفاصيل اليومية" else "عرض التفاصيل اليومية", color = AdminCyan) }
                    if (expanded == s.employeeId) {
                        val detail = dates.map { d -> buildAdminDay(s.employeeId, d, auditIndex, requestRows) }
                        detail.forEach { day -> AdminReportDayRow(day) }
                    }
                }
            }
        }
        if (summaries.isEmpty()) item { AdminEmpty("لا توجد بيانات موظفين للتقرير.") }
    }
}

private fun buildAdminAuditIndex(audit: List<Map<String, Any?>>): Map<String, Pair<Map<String, Any?>?, Map<String, Any?>?>> {
    val map = mutableMapOf<String, Pair<Map<String, Any?>?, Map<String, Any?>?>>()
    audit.filter { it["result"]?.toString() == "success" && it["employeeId"] != null }.forEach { row ->
        val employeeId = row["employeeId"].toString()
        val timestamp = row["timestamp"]?.toString().orEmpty()
        val date = timestamp.take(10)
        if (date.length != 10) return@forEach
        val key = "$employeeId|$date"
        val current = map[key]
        when (row["action"]?.toString()) {
            "check-in" -> if (current?.first == null || timestamp < current.first?.get("timestamp")?.toString().orEmpty()) map[key] = row to current?.second
            "check-out" -> if (current?.second == null || timestamp > current.second?.get("timestamp")?.toString().orEmpty()) map[key] = current?.first to row
        }
    }
    return map
}

private fun buildAdminSummary(employee: Map<String, Any?>, dates: List<LocalDate>, index: Map<String, Pair<Map<String, Any?>?, Map<String, Any?>?>>, requests: List<EmployeeRequest>): AdminReportSummary {
    val id = employee["id"]?.toString().orEmpty()
    var workDays = 0; var present = 0; var absent = 0; var early = 0; var late = 0; var open = 0; var permission = 0; var leave = 0; var off = 0; var worked = 0; var lateMinutes = 0; var earlyMinutes = 0
    dates.forEach { d ->
        val req = requests.firstOrNull { it.employeeId == id && (it.status == "approved" || it.status == "confirmed") && requestCovers(it, d) }
        val weekday = d.dayOfWeek.value
        val isWorkDay = weekday <= 5
        if (!isWorkDay) { off++; return@forEach }
        workDays++
        if (req?.type == "leave") { leave++; return@forEach }
        if (req?.type == "permission") { permission++; return@forEach }
        val pair = index["$id|$d"]
        val cin = pair?.first?.get("timestamp")?.toString()
        val cout = pair?.second?.get("timestamp")?.toString()
        if (cin == null) { absent++; return@forEach }
        val cinMin = instantMinutes(cin); val coutMin = cout?.let(::instantMinutes)
        val start = employee["workStartTime"]?.toString()?.let(::clockMinutes) ?: 8 * 60
        val end = employee["workEndTime"]?.toString()?.let(::clockMinutes) ?: 16 * 60
        val grace = employee["gracePeriodMinutes"]?.toString()?.toIntOrNull() ?: 10
        val lm = maxOf(0, cinMin - start - grace); lateMinutes += lm
        if (coutMin == null) { open++; return@forEach }
        worked += maxOf(0, coutMin - cinMin)
        val em = maxOf(0, end - coutMin); earlyMinutes += em
        when { em > 0 -> early++; lm > 0 -> late++; else -> present++ }
    }
    return AdminReportSummary(id, employee["name"]?.toString() ?: "بدون اسم", employee["jobNumber"]?.toString() ?: "—", workDays, present, absent, early, late, open, permission, leave, off, worked, lateMinutes, earlyMinutes)
}

private fun buildAdminDay(employeeId: String, date: LocalDate, index: Map<String, Pair<Map<String, Any?>?, Map<String, Any?>?>>, requests: List<EmployeeRequest>): AdminReportDay {
    val req = requests.firstOrNull { it.employeeId == employeeId && (it.status == "approved" || it.status == "confirmed") && requestCovers(it, date) }
    if (date.dayOfWeek.value > 5) return AdminReportDay(date, "راحة/عطلة", "—", "—", 0, 0, 0, "يوم راحة/عطلة")
    if (req?.type == "leave") return AdminReportDay(date, "إجازة", "—", "—", 0, 0, 0, req.reason ?: "إجازة معتمدة")
    if (req?.type == "permission") return AdminReportDay(date, "استئذان", "—", "—", 0, 0, 0, req.reason ?: "استئذان معتمد")
    val pair = index["$employeeId|$date"]
    val cin = pair?.first?.get("timestamp")?.toString()
    val cout = pair?.second?.get("timestamp")?.toString()
    if (cin == null) return AdminReportDay(date, "غياب", "—", "—", 0, 0, 0, "لم يسجل حضورًا")
    val cinMin = instantMinutes(cin); val coutMin = cout?.let(::instantMinutes); val start = 8 * 60; val end = 16 * 60; val grace = 10
    val lm = maxOf(0, cinMin - start - grace)
    if (coutMin == null) return AdminReportDay(date, "تسجيل ناقص", formatAdminClock(cinMin), "—", 0, lm, 0, "لم يسجل الانصراف")
    val worked = maxOf(0, coutMin - cinMin); val em = maxOf(0, end - coutMin)
    val status = when { em > 0 -> "انصراف مبكر"; lm > 0 -> "متأخر"; else -> "حاضر" }
    return AdminReportDay(date, status, formatAdminClock(cinMin), formatAdminClock(coutMin), worked, lm, em, "يوم عمل")
}

private fun requestCovers(r: EmployeeRequest, date: LocalDate): Boolean {
    val start = r.startDate?.take(10) ?: r.createdAt?.take(10) ?: return false
    val end = r.endDate?.take(10) ?: start
    return date.toString() >= start && date.toString() <= end
}

private fun instantMinutes(value: String): Int {
    val time = value.substringAfter("T", value).substringAfter(" ").take(5)
    return clockMinutes(time)
}

private fun clockMinutes(value: String): Int {
    val parts = value.take(5).split(":")
    return (parts.getOrNull(0)?.toIntOrNull() ?: 0) * 60 + (parts.getOrNull(1)?.toIntOrNull() ?: 0)
}

private fun formatAdminMinutes(value: Int): String = "${value / 60}س ${value % 60}د"
private fun formatAdminClock(value: Int): String = "%02d:%02d".format(Locale.US, value / 60, value % 60)

private fun buildAdminCsv(summaries: List<AdminReportSummary>, mode: String, date: String, month: String, year: String): String {
    val period = when (mode) { "daily" -> date; "annual" -> year; else -> month }
    return buildString {
        appendLine("تقرير حاضر,$period")
        appendLine("الموظف,الرقم الوظيفي,أيام العمل,حاضر,غياب,انصراف مبكر,متأخر,تسجيل ناقص,استئذان,إجازة,راحة,ساعات العمل,دقائق التأخير,دقائق الانصراف المبكر")
        summaries.forEach { s -> appendLine(listOf(s.name, s.job, s.workDays, s.present, s.absent, s.early, s.late, s.open, s.permission, s.leave, s.off, formatAdminMinutes(s.workedMinutes), s.lateMinutes, s.earlyMinutes).joinToString(",") { csvEscape(it.toString()) }) }
    }
}

private fun csvEscape(value: String): String = "\"${value.replace("\"", "\"\"")}\""

@Composable
private fun AdminReportDayRow(day: AdminReportDay) {
    Column(Modifier.fillMaxWidth().background(AdminPanel, RoundedCornerShape(14.dp)).padding(11.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(day.status, color = when (day.status) { "حاضر" -> AdminGreen; "متأخر" -> AdminAmber; "غياب" -> AdminRed; else -> AdminCyan }, fontWeight = FontWeight.Black, fontSize = 11.sp)
            Text("${day.date.dayOfWeek.getDisplayName(TextStyle.FULL, Locale("ar"))} · ${day.date}", color = AdminText, fontSize = 11.sp, textAlign = TextAlign.Right)
        }
        Text("الدخول ${day.checkIn} · الخروج ${day.checkOut}", color = AdminMuted, fontSize = 11.sp, modifier = Modifier.padding(top = 4.dp).fillMaxWidth(), textAlign = TextAlign.Right)
        Text("العمل ${formatAdminMinutes(day.workedMinutes)} · التأخير ${formatAdminMinutes(day.lateMinutes)} · المبكر ${formatAdminMinutes(day.earlyMinutes)}", color = AdminMuted, fontSize = 11.sp, modifier = Modifier.padding(top = 3.dp).fillMaxWidth(), textAlign = TextAlign.Right)
        Text(day.detail, color = AdminMuted, fontSize = 10.sp, modifier = Modifier.padding(top = 3.dp).fillMaxWidth(), textAlign = TextAlign.Right)
    }
}

@Composable
private fun AdminAudit(vm: NativeAdminViewModel, p: PaddingValues) {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 14.dp, end = 14.dp, bottom = 22.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { AdminHeader("سجل التدقيق", "آخر العمليات المسجلة من الخادم") }
        vm.error?.let { msg -> item { AdminError(msg) } }
        items(vm.audit.take(120)) { a ->
            AdminCard { Column(Modifier.padding(14.dp)) { Text("${a["action"] ?: "حدث"} · ${a["actorName"] ?: a["jobNumber"] ?: "—"}", color = AdminText, fontWeight = FontWeight.Bold, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Right); Text("${a["timestamp"] ?: ""} · ${a["result"] ?: ""}", color = AdminMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp).fillMaxWidth(), textAlign = TextAlign.Right) } }
        }
        if (vm.audit.isEmpty()) item { AdminEmpty("لا توجد أحداث تدقيق.") }
    }
}

@Composable
private fun AdminCard(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Card(modifier.fillMaxWidth(), shape = RoundedCornerShape(24.dp), colors = CardDefaults.cardColors(containerColor = AdminCard), border = androidx.compose.foundation.BorderStroke(1.dp, AdminBorder), elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)) {
        Column(Modifier.background(Brush.linearGradient(listOf(AdminCard, Color(0xFF11161F)))).padding(18.dp), content = content)
    }
}

@Composable
private fun AdminMetric(label: String, value: Int, accent: Color, modifier: Modifier) {
    Box(modifier.background(accent.copy(alpha = .06f), RoundedCornerShape(18.dp)).padding(13.dp)) { Column(horizontalAlignment = Alignment.End, modifier = Modifier.fillMaxWidth()) { Text(label, color = AdminMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold); Text(value.toString(), color = AdminText, fontSize = 26.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 3.dp)) } }
}

@Composable
private fun AdminAction(icon: androidx.compose.ui.graphics.vector.ImageVector, title: String, subtitle: String, accent: Color) {
    AdminCard { Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) { Box(Modifier.width(44.dp).height(44.dp).background(accent.copy(alpha = .10f), RoundedCornerShape(14.dp)), contentAlignment = Alignment.Center) { Icon(icon, null, tint = accent) }; Spacer(Modifier.width(12.dp)); Column(Modifier.weight(1f), horizontalAlignment = Alignment.End) { Text(title, color = AdminText, fontWeight = FontWeight.Black, textAlign = TextAlign.Right); Text(subtitle, color = AdminMuted, fontSize = 11.sp, modifier = Modifier.padding(top = 3.dp), textAlign = TextAlign.Right) } } }
}

@Composable
private fun AdminEmployeeRow(name: String, job: String, status: String) {
    AdminCard { Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) { Box(Modifier.width(46.dp).height(46.dp).background(AdminGreen.copy(alpha = .10f), RoundedCornerShape(15.dp)), contentAlignment = Alignment.Center) { Text(name.firstOrNull()?.toString() ?: "م", color = AdminGreen, fontSize = 20.sp, fontWeight = FontWeight.Black) }; Spacer(Modifier.width(12.dp)); Column(Modifier.weight(1f), horizontalAlignment = Alignment.End) { Text(name, color = AdminText, fontWeight = FontWeight.Black, textAlign = TextAlign.Right); Text("$job · $status", color = AdminMuted, fontSize = 11.sp, modifier = Modifier.padding(top = 3.dp), textAlign = TextAlign.Right) } } }
}

@Composable
private fun AdminError(message: String) { Box(Modifier.fillMaxWidth().background(AdminRed.copy(alpha = .08f), RoundedCornerShape(18.dp)).padding(14.dp)) { Text(message, color = AdminRed, fontSize = 12.sp, textAlign = TextAlign.Right, modifier = Modifier.fillMaxWidth()) } }
@Composable
private fun AdminEmpty(message: String) { Box(Modifier.fillMaxWidth().padding(vertical = 26.dp), contentAlignment = Alignment.Center) { Text(message, color = AdminMuted, fontSize = 13.sp) } }
@Composable
private fun AdminSurface(content: @Composable () -> Unit) { Box(Modifier.fillMaxSize().background(AdminBg)) { content() } }
@Composable
private fun AdminBrand(size: androidx.compose.ui.unit.Dp = 54.dp) { Box(Modifier.width(size).height(size).background(AdminGreen, RoundedCornerShape(size / 3)), contentAlignment = Alignment.Center) { Text("ح", color = AdminBg, fontSize = (size.value * .48f).sp, fontWeight = FontWeight.Black) } }
private fun requestLabel(type: String) = when (type) { "leave" -> "إجازة"; "checkout" -> "انصراف"; else -> "استئذان" }
private fun statusLabel(status: String) = when (status) { "approved" -> "مقبول"; "rejected" -> "مرفوض"; "confirmed" -> "مؤكد"; else -> "قيد المراجعة" }
private fun statusColor(status: String) = when (status) { "approved", "confirmed" -> AdminGreen; "rejected" -> AdminRed; else -> AdminAmber }