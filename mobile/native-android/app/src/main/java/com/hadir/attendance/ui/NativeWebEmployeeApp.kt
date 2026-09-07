package com.hadir.attendance.ui

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import kotlinx.coroutines.delay
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private val WebBg = Color(0xFF0C1018)
private val WebCard = Color(0xFF171C26)
private val WebPanel = Color(0xFF202631)
private val WebBorder = Color(0xFF303744)
private val WebGreen = Color(0xFF35C995)
private val WebCyan = Color(0xFF35C7F2)
private val WebAmber = Color(0xFFE9A52D)
private val WebText = Color(0xFFF0F3F7)
private val WebMuted = Color(0xFFACB4C1)

@Composable
fun NativeWebEmployeeApp(
    vm: NativeMainViewModel = androidx.lifecycle.viewmodel.compose.viewModel(),
    onEmployeeAuthenticated: () -> Unit = {},
    onEmployeeLoggedOut: () -> Unit = {}
) {
    var notified by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { vm.restoreSession() }
    LaunchedEffect(vm.employee) {
        if (vm.employee != null && !notified) { notified = true; onEmployeeAuthenticated() }
        else if (vm.employee == null && notified) { notified = false; onEmployeeLoggedOut() }
    }
    if (vm.employee == null) WebLogin(vm) else WebEmployeeShell(vm)
}

@Composable
private fun WebLogin(vm: NativeMainViewModel) {
    var user by remember { mutableStateOf("") }
    var pass by remember { mutableStateOf("") }
    Surface(Modifier.fillMaxSize(), color = WebBg) {
        Box(Modifier.fillMaxSize().padding(20.dp), contentAlignment = Alignment.Center) {
            HudCard { Brand(); Spacer(Modifier.height(18.dp)); Text("مرحبًا بك في حاضر", color = WebText, fontSize = 27.sp, fontWeight = FontWeight.Black); Text("تطبيق الموظف للحضور وإدارة يوم العمل", color = WebMuted, modifier = Modifier.padding(top = 6.dp, bottom = 22.dp)); OutlinedTextField(user, { user = it }, Modifier.fillMaxWidth(), label = { Text("رقم الموظف") }, singleLine = true, colors = webFields()); OutlinedTextField(pass, { pass = it }, Modifier.fillMaxWidth().padding(top = 12.dp), label = { Text("الرمز / كلمة المرور") }, singleLine = true, colors = webFields()); vm.error?.let { Text(it, color = Color(0xFFF05A67), modifier = Modifier.padding(top = 10.dp)) }; Button(onClick = { vm.login(user, pass) }, enabled = user.isNotBlank() && pass.isNotBlank() && !vm.loading, modifier = Modifier.fillMaxWidth().padding(top = 18.dp).height(52.dp), shape = RoundedCornerShape(14.dp), colors = ButtonDefaults.buttonColors(containerColor = WebGreen, contentColor = Color(0xFF06261B))) { Text(if (vm.loading) "جارٍ الدخول…" else "دخول", fontWeight = FontWeight.Black) } }
        }
    }
}

@Composable
private fun WebEmployeeShell(vm: NativeMainViewModel) {
    val context = LocalContext.current
    var tab by remember { mutableIntStateOf(0) }
    var scanner by remember { mutableStateOf(false) }
    var pendingType by remember { mutableStateOf("check-in") }
    var requestDialog by remember { mutableStateOf(false) }
    var menuDialog by remember { mutableStateOf(false) }
    var profileMenu by remember { mutableStateOf(false) }
    var requestType by remember { mutableStateOf("permission") }
    var requestReason by remember { mutableStateOf("") }
    var requestStart by remember { mutableStateOf("") }
    var requestEnd by remember { mutableStateOf("") }
    val locationAllowed = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    val cameraAllowed = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result -> if (result[Manifest.permission.ACCESS_FINE_LOCATION] == true && result[Manifest.permission.CAMERA] == true) scanner = true }
    LaunchedEffect(Unit) { vm.refresh() }
    LaunchedEffect(tab) { if (tab == 3) vm.refreshRequests() }

    if (scanner) { QrScanner(onResult = { code -> scanner = false; vm.clock(pendingType, code, true) }, onCancel = { scanner = false }); return }
    if (requestDialog) RequestDialog(vm, requestType, { requestType = it }, requestReason, { requestReason = it }, requestStart, { requestStart = it }, requestEnd, { requestEnd = it }, { requestDialog = false })
    if (menuDialog) MenuDialog({ menuDialog = false }) { vm.logout() }

    Surface(Modifier.fillMaxSize(), color = WebBg) {
        Scaffold(
            containerColor = WebBg,
            bottomBar = {
                WebBottomToolbar(
                    onMenu = { menuDialog = true },
                    onNotifications = { },
                    onWeather = { }
                )
            }
        ) { bottomPadding ->
            Column(Modifier.fillMaxSize().padding(bottomPadding)) {
                WebHeader(
                    employeeName = vm.employee?.name.orEmpty(),
                    profileMenu = profileMenu,
                    onProfile = { profileMenu = !profileMenu },
                    onDismissProfile = { profileMenu = false },
                    tab = tab,
                    onTab = { tab = it; profileMenu = false }
                )
                LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(12.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    item { Column(Modifier.padding(horizontal = 4.dp)) { Text("HADIR · EMPLOYEE", color = WebMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 2.sp); Text(tabTitle(tab), color = WebText, fontSize = 31.sp, fontWeight = FontWeight.Black) } }
                    when (tab) {
                        0 -> item { HomeContent(vm, locationAllowed, cameraAllowed, { type -> pendingType = type; if (locationAllowed && cameraAllowed) scanner = true else permissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.CAMERA)) }, { requestDialog = true }) }
                        1 -> item { HoursContent(vm) }
                        2 -> item { CenterContent(vm) }
                        3 -> item { RequestsContent(vm) { requestDialog = true } }
                        4 -> item { AccountContent(vm) }
                    }
                }
            }
        }
    }
}

@Composable
private fun WebHeader(
    employeeName: String,
    profileMenu: Boolean,
    onProfile: () -> Unit,
    onDismissProfile: () -> Unit,
    tab: Int,
    onTab: (Int) -> Unit
) {
    Box(Modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth().height(78.dp).padding(horizontal = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
            Brand()
            Box {
                OutlinedButton(onClick = onProfile, modifier = Modifier.height(58.dp), shape = RoundedCornerShape(16.dp), border = BorderStroke(1.dp, if (profileMenu) WebGreen else WebBorder), colors = ButtonDefaults.outlinedButtonColors(containerColor = if (profileMenu) Color(0xFF123D32) else WebCard, contentColor = WebText)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Box(Modifier.size(38.dp).background(WebPanel, CircleShape).border(1.dp, WebGreen.copy(alpha = .65f), CircleShape), contentAlignment = Alignment.Center) {
                            Text(employeeName.firstOrNull()?.toString() ?: "م", color = WebGreen, fontWeight = FontWeight.Black)
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text("الملف الشخصي", color = WebMuted, fontSize = 9.sp)
                            Text(employeeName.ifBlank { "الموظف" }, color = WebText, fontSize = 11.sp, fontWeight = FontWeight.Black)
                        }
                        Icon(Icons.Default.ExpandMore, null, Modifier.size(18.dp))
                    }
                }
                DropdownMenu(expanded = profileMenu, onDismissRequest = onDismissProfile, modifier = Modifier.background(WebCard)) {
                    Text("أقسام الموظف", color = WebMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp))
                    val nav = listOf("لوحة الموظف" to Icons.Default.GridView, "سجل العمل" to Icons.Default.AccessTime, "مركز الموظف" to Icons.Default.Business, "الطلبات" to Icons.Default.ListAlt, "الملف الشخصي" to Icons.Default.Person)
                    nav.forEachIndexed { i, pair ->
                        DropdownMenuItem(
                            text = { Text(pair.first, color = if (i == tab) WebGreen else WebText, fontWeight = if (i == tab) FontWeight.Bold else FontWeight.Normal) },
                            leadingIcon = { Icon(pair.second, null, tint = if (i == tab) WebGreen else WebMuted) },
                            onClick = { onTab(i) }
                        )
                    }
                }
            }
        }
        HorizontalDivider(color = WebBorder)
    }
}

@Composable
private fun WebBottomToolbar(onMenu: () -> Unit, onNotifications: () -> Unit, onWeather: () -> Unit) {
    NavigationBar(containerColor = WebCard, contentColor = WebText) {
        NavigationBarItem(selected = false, onClick = onMenu, icon = { Icon(Icons.Default.Menu, null) }, label = { Text("القائمة", fontSize = 10.sp) })
        NavigationBarItem(selected = false, onClick = onNotifications, icon = { Icon(Icons.Default.Notifications, null) }, label = { Text("الإشعارات", fontSize = 10.sp) })
        NavigationBarItem(selected = false, onClick = onWeather, icon = { Icon(Icons.Default.WbSunny, null) }, label = { Text("الطقس", fontSize = 10.sp) })
    }
}

@Composable private fun HomeContent(vm: NativeMainViewModel, locationAllowed: Boolean, cameraAllowed: Boolean, onClock: (String) -> Unit, onRequest: () -> Unit) {
    var now by remember { mutableStateOf(Date()) }
    LaunchedEffect(Unit) { while (true) { delay(1000); now = Date() } }
    val latest = vm.attendance.maxByOrNull { it.timestamp }
    val checkedIn = latest?.type == "check-in"
    val status = if (checkedIn) "حاضر" else "متأخر"
    val statusColor = if (checkedIn) WebGreen else WebAmber
    HudCard {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
            Row(verticalAlignment = Alignment.CenterVertically) { Box(Modifier.size(54.dp).border(1.dp, WebGreen.copy(alpha = .45f), RoundedCornerShape(16.dp)).background(WebPanel, RoundedCornerShape(16.dp)), contentAlignment = Alignment.Center) { Text(vm.employee?.name?.firstOrNull()?.toString() ?: "م", color = WebGreen, fontSize = 22.sp, fontWeight = FontWeight.Black) }; Spacer(Modifier.width(10.dp)); Column { Text("مرحبًا بك", color = WebMuted, fontSize = 11.sp); Text(vm.employee?.name.orEmpty(), color = WebText, fontSize = 17.sp, fontWeight = FontWeight.Black); Text("${vm.employee?.jobNumber.orEmpty()} · المقر الرئيسي", color = WebMuted, fontSize = 11.sp) } }
            Column(horizontalAlignment = Alignment.End) { Text(SimpleDateFormat("HH:mm", Locale.US).format(now), color = WebText, fontSize = 21.sp, fontWeight = FontWeight.Black); Text(SimpleDateFormat("EEEE، dd MMM", Locale("ar" )).format(now), color = WebMuted, fontSize = 10.sp) }
        }
        Spacer(Modifier.height(16.dp))
        StatusPanel(status, statusColor, if (checkedIn) "أنت مسجل حضور الآن." else "تم تسجيل حضورك حسب حالة الدوام.")
    }
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) { Action("↑", "تسجيل حضور", "مسح رمز QR", WebCyan, !checkedIn) { onClock("check-in") }; Action("↓", "تسجيل انصراف", "إنهاء الدوام الآن", WebGreen, checkedIn) { onClock("check-out") } }
    HudCard { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text("ملخص اليوم", color = WebMuted, fontSize = 11.sp); Text("سجل الدوام", color = WebText, fontSize = 19.sp, fontWeight = FontWeight.Black) }; Spacer(Modifier.height(12.dp)); Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) { Mini("الحضور", vm.attendance.count { it.type == "check-in" }.toString(), Modifier.weight(1f)); Mini("الانصراف", vm.attendance.count { it.type == "check-out" }.toString(), Modifier.weight(1f)); Mini("السجلات", vm.attendance.size.toString(), Modifier.weight(1f)) } }
    HudCard { Text("معلومات الدوام", color = WebMuted, fontSize = 11.sp); Text("حالتك الحالية", color = WebText, fontSize = 19.sp, fontWeight = FontWeight.Black); Spacer(Modifier.height(12.dp)); Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) { Info("نوع الدوام", if (vm.employee?.scheduleType == "ROTATION") "تناوبي" else "ثابت", Modifier.weight(1f)); Info("وقت الدوام", "${vm.employee?.workStartTime ?: "09:00"} → ${vm.employee?.workEndTime ?: "16:00"}", Modifier.weight(1f)) }; Spacer(Modifier.height(8.dp)); Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) { Info("الموقع", vm.employee?.locationId ?: "المقر الرئيسي", Modifier.weight(1f)); Info("الحالة", status, Modifier.weight(1f)) } }
    OutlinedButton(onClick = onRequest, modifier = Modifier.fillMaxWidth().height(72.dp), shape = RoundedCornerShape(18.dp), border = BorderStroke(1.dp, WebCyan.copy(alpha = .4f)), colors = ButtonDefaults.outlinedButtonColors(contentColor = WebCyan)) { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) { Column(horizontalAlignment = Alignment.End) { Text("طلب استئذان أو إجازة", fontWeight = FontWeight.Black, fontSize = 17.sp); Text("إرسال طلب للإدارة", color = WebMuted, fontSize = 10.sp) }; Text("←", fontSize = 25.sp, fontWeight = FontWeight.Black) } }
    if (!locationAllowed || !cameraAllowed) Text("سيطلب التطبيق صلاحية الموقع والكاميرا عند الضغط على تسجيل الحضور أو الانصراف.", color = WebMuted, fontSize = 10.sp, textAlign = TextAlign.Center)
}

@Composable private fun StatusPanel(status: String, color: Color, detail: String) { Box(Modifier.fillMaxWidth().border(1.dp, color.copy(alpha = .55f), RoundedCornerShape(18.dp)).background(color.copy(alpha = .07f), RoundedCornerShape(18.dp)).padding(15.dp)) { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) { Column { Text("حالة اليوم", color = WebMuted, fontSize = 11.sp); Text(status, color = WebText, fontSize = 21.sp, fontWeight = FontWeight.Black); Text(detail, color = WebMuted, fontSize = 11.sp, modifier = Modifier.padding(top = 4.dp)) }; Surface(color = color.copy(alpha = .15f), shape = RoundedCornerShape(50)) { Text(status, color = color, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 12.dp, vertical = 5.dp)) } } } }

@Composable private fun HoursContent(vm: NativeMainViewModel) { HudCard { Text("سجل الحضور والانصراف", color = WebText, fontSize = 20.sp, fontWeight = FontWeight.Black); Text("جميع السجلات المتزامنة مع الخادم", color = WebMuted, fontSize = 11.sp, modifier = Modifier.padding(top = 4.dp)); Spacer(Modifier.height(12.dp)); vm.attendance.sortedByDescending { it.timestamp }.take(30).forEach { r -> Row(Modifier.fillMaxWidth().padding(vertical = 7.dp), horizontalArrangement = Arrangement.SpaceBetween) { Text(if (r.type == "check-in") "حضور" else "انصراف", color = if (r.type == "check-in") WebCyan else WebGreen, fontWeight = FontWeight.Bold); Text(timeText(r.timestamp), color = WebText) } }; if (vm.attendance.isEmpty()) Text("لا توجد سجلات حضور بعد", color = WebMuted) } }

@Composable private fun CenterContent(vm: NativeMainViewModel) { HudCard { Text("بطاقة الموظف", color = WebMuted, fontSize = 11.sp); Text(vm.employee?.name.orEmpty(), color = WebText, fontSize = 23.sp, fontWeight = FontWeight.Black); Text(vm.employee?.jobNumber.orEmpty(), color = WebMuted, modifier = Modifier.padding(top = 3.dp)); Spacer(Modifier.height(14.dp)); Info("نوع الدوام", if (vm.employee?.scheduleType == "ROTATION") "تناوبي" else "ثابت", Modifier.fillMaxWidth()); Spacer(Modifier.height(8.dp)); Info("الموقع", vm.employee?.locationId ?: "المقر الرئيسي", Modifier.fillMaxWidth()); Spacer(Modifier.height(8.dp)); Info("وقت الدوام", "${vm.employee?.workStartTime ?: "09:00"} → ${vm.employee?.workEndTime ?: "16:00"}", Modifier.fillMaxWidth()) } }

@Composable private fun RequestsContent(vm: NativeMainViewModel, onNew: () -> Unit) { Column(verticalArrangement = Arrangement.spacedBy(10.dp)) { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) { Column { Text("طلباتي", color = WebText, fontSize = 20.sp, fontWeight = FontWeight.Black); Text("الإجازات والاستئذانات والانصراف المبكر", color = WebMuted, fontSize = 11.sp) }; Button(onClick = onNew, colors = ButtonDefaults.buttonColors(containerColor = WebGreen, contentColor = Color(0xFF06261B))) { Text("طلب جديد", fontWeight = FontWeight.Bold) } }; vm.requests.forEach { r -> HudCard { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text(requestLabel(r.type), color = WebText, fontWeight = FontWeight.Black); Text(requestStatus(r.status), color = if (r.status == "approved" || r.status == "confirmed") WebGreen else WebAmber, fontSize = 11.sp) }; Text(r.reason ?: "بدون سبب", color = WebMuted, fontSize = 11.sp, modifier = Modifier.padding(top = 7.dp)) } }; if (vm.requests.isEmpty()) EmptyHud("لا توجد طلبات حتى الآن") } }

@Composable private fun AccountContent(vm: NativeMainViewModel) { HudCard { Text("الملف الشخصي", color = WebMuted, fontSize = 11.sp); Text(vm.employee?.name.orEmpty(), color = WebText, fontSize = 23.sp, fontWeight = FontWeight.Black); Text(vm.employee?.jobNumber.orEmpty(), color = WebMuted, modifier = Modifier.padding(top = 4.dp)); Spacer(Modifier.height(14.dp)); Info("الحالة", vm.employee?.status ?: "فعال", Modifier.fillMaxWidth()); Spacer(Modifier.height(8.dp)); Info("المعرف", vm.employee?.id.orEmpty(), Modifier.fillMaxWidth()) }; Button(onClick = { vm.logout() }, modifier = Modifier.fillMaxWidth().height(52.dp), shape = RoundedCornerShape(14.dp), colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4B151C), contentColor = Color(0xFFFFB4AB))) { Text("تسجيل الخروج", fontWeight = FontWeight.Bold) } }

@Composable private fun Action(symbol: String, title: String, subtitle: String, accent: Color, enabled: Boolean, onClick: () -> Unit) { OutlinedButton(onClick = onClick, enabled = enabled, modifier = Modifier.weight(1f).height(150.dp), shape = RoundedCornerShape(18.dp), border = BorderStroke(1.dp, WebBorder), colors = ButtonDefaults.outlinedButtonColors(containerColor = WebCard, contentColor = WebText, disabledContentColor = WebMuted)) { Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.End) { Text(symbol, color = accent, fontSize = 30.sp, fontWeight = FontWeight.Black); Spacer(Modifier.height(14.dp)); Text(title, fontSize = 16.sp, fontWeight = FontWeight.Black); Text(subtitle, color = WebMuted, fontSize = 10.sp, modifier = Modifier.padding(top = 4.dp)) } } }
@Composable private fun Mini(label: String, value: String, modifier: Modifier) { Box(modifier.border(1.dp, WebBorder, RoundedCornerShape(14.dp)).background(WebPanel, RoundedCornerShape(14.dp)).padding(12.dp)) { Column { Text(label, color = WebMuted, fontSize = 10.sp); Text(value, color = WebText, fontSize = 18.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 3.dp)) } } }
@Composable private fun Info(label: String, value: String, modifier: Modifier) { Box(modifier.border(1.dp, WebBorder, RoundedCornerShape(14.dp)).background(WebPanel, RoundedCornerShape(14.dp)).padding(12.dp)) { Column { Text(label, color = WebMuted, fontSize = 10.sp); Text(value, color = WebText, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 4.dp)) } } }
@Composable private fun HudCard(content: @Composable ColumnScope.() -> Unit) { Column(Modifier.fillMaxWidth().border(1.dp, WebBorder, RoundedCornerShape(20.dp)).background(WebCard, RoundedCornerShape(20.dp)).padding(16.dp), content = content) }
@Composable private fun EmptyHud(text: String) { HudCard { Text(text, color = WebMuted, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center) } }

@Composable private fun RequestDialog(vm: NativeMainViewModel, type: String, onType: (String) -> Unit, reason: String, onReason: (String) -> Unit, start: String, onStart: (String) -> Unit, end: String, onEnd: (String) -> Unit, close: () -> Unit) { AlertDialog(onDismissRequest = close, containerColor = WebCard, titleContentColor = WebText, textContentColor = WebMuted, title = { Text("طلب جديد", fontWeight = FontWeight.Black) }, text = { Column(verticalArrangement = Arrangement.spacedBy(10.dp)) { Text("اختر نوع الطلب"); Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) { listOf("permission" to "استئذان", "leave" to "إجازة", "checkout" to "انصراف مبكر").forEach { (id, label) -> FilterChip(type == id, { onType(id) }, label = { Text(label) }) } }; OutlinedTextField(reason, onReason, Modifier.fillMaxWidth(), label = { Text("السبب") }, minLines = 2, colors = webFields()); OutlinedTextField(start, onStart, Modifier.fillMaxWidth(), label = { Text("تاريخ البداية") }, singleLine = true, colors = webFields()); OutlinedTextField(end, onEnd, Modifier.fillMaxWidth(), label = { Text("تاريخ النهاية") }, singleLine = true, colors = webFields()) } }, confirmButton = { Button(onClick = { vm.addRequest(type, reason, start, end); close() }, colors = ButtonDefaults.buttonColors(containerColor = WebGreen, contentColor = Color(0xFF06261B))) { Text("إرسال") } }, dismissButton = { TextButton(onClick = close) { Text("إلغاء", color = WebMuted) } }) }
@Composable private fun MenuDialog(close: () -> Unit, logout: () -> Unit) { AlertDialog(onDismissRequest = close, containerColor = WebCard, title = { Text("القائمة", color = WebText, fontWeight = FontWeight.Black) }, text = { Text("إعدادات واجهة الموظف", color = WebMuted) }, confirmButton = { TextButton(onClick = { close(); logout() }) { Text("تسجيل الخروج", color = Color(0xFFF05A67)) } }, dismissButton = { TextButton(onClick = close) { Text("إغلاق", color = WebMuted) } }) }

private fun webFields() = OutlinedTextFieldDefaults.colors(focusedBorderColor = WebGreen, unfocusedBorderColor = WebBorder, focusedLabelColor = WebGreen, unfocusedLabelColor = WebMuted, cursorColor = WebGreen, focusedTextColor = WebText, unfocusedTextColor = WebText)
private fun tabTitle(tab: Int) = listOf("لوحة الموظف", "سجل العمل", "مركز الموظف", "الطلبات", "الملف الشخصي")[tab]
private fun timeText(value: String): String = try { SimpleDateFormat("HH:mm", Locale.US).format(SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.US).parse(value) ?: Date()) } catch (_: Exception) { value.takeLast(5) }
private fun requestLabel(type: String) = when (type) { "permission" -> "استئذان"; "leave" -> "إجازة"; "checkout" -> "انصراف مبكر"; else -> type }
private fun requestStatus(status: String) = when (status) { "approved", "confirmed" -> "مقبول"; "rejected" -> "مرفوض"; else -> "قيد المراجعة" }
