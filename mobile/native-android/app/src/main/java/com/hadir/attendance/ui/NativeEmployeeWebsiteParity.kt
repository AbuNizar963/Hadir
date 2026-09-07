package com.hadir.attendance.ui

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.delay
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private val SiteBg = Color(0xFF0C1018)
private val SiteCard = Color(0xFF171C26)
private val SitePanel = Color(0xFF202631)
private val SiteBorder = Color(0xFF303744)
private val SiteGreen = Color(0xFF35C995)
private val SiteCyan = Color(0xFF35C7F2)
private val SiteAmber = Color(0xFFE9A52D)
private val SiteRed = Color(0xFFF05A67)
private val SiteText = Color(0xFFF0F3F7)
private val SiteMuted = Color(0xFFACB4C1)

@Composable
fun NativeEmployeeWebsiteParityApp(
    vm: NativeMainViewModel = viewModel(),
    services: NativeServicesViewModel = viewModel(),
    onEmployeeAuthenticated: () -> Unit = {},
    onEmployeeLoggedOut: () -> Unit = {}
) {
    var announced by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { vm.restoreSession() }
    LaunchedEffect(vm.employee) {
        if (vm.employee != null && !announced) { announced = true; onEmployeeAuthenticated() }
        if (vm.employee == null && announced) { announced = false; onEmployeeLoggedOut() }
    }
    MaterialTheme(colorScheme = darkColorScheme(background = SiteBg, surface = SiteCard, surfaceVariant = SitePanel, primary = SiteGreen, secondary = SiteCyan, error = SiteRed, onBackground = SiteText, onSurface = SiteText, onSurfaceVariant = SiteMuted, onPrimary = Color(0xFF06261B), outline = SiteBorder)) {
        if (vm.employee == null) EmployeeLogin(vm) else EmployeeWorkspace(vm, services)
    }
}

@Composable private fun EmployeeLogin(vm: NativeMainViewModel) {
    var user by remember { mutableStateOf("") }
    var pass by remember { mutableStateOf("") }
    Surface(Modifier.fillMaxSize(), color = SiteBg) {
        Box(Modifier.fillMaxSize().padding(18.dp), contentAlignment = Alignment.Center) {
            HudCard(Modifier.widthIn(max = 560.dp)) {
                Brand()
                Spacer(Modifier.height(18.dp))
                Text("مرحبًا بك في حاضر", color = SiteText, fontSize = 28.sp, fontWeight = FontWeight.Black)
                Text("تسجيل الدخول إلى مساحة الموظف", color = SiteMuted, fontSize = 13.sp, modifier = Modifier.padding(top = 5.dp, bottom = 20.dp))
                Field(user, { user = it }, "رقم الموظف")
                Spacer(Modifier.height(10.dp))
                Field(pass, { pass = it }, "الرمز / كلمة المرور")
                vm.error?.let { Text(it, color = SiteRed, fontSize = 12.sp, modifier = Modifier.padding(top = 9.dp)) }
                Button(onClick = { vm.login(user, pass) }, enabled = user.isNotBlank() && pass.isNotBlank() && !vm.loading, modifier = Modifier.fillMaxWidth().padding(top = 16.dp).height(52.dp), shape = RoundedCornerShape(14.dp), colors = ButtonDefaults.buttonColors(containerColor = SiteGreen, contentColor = Color(0xFF06261B))) {
                    Text(if (vm.loading) "جارٍ الدخول…" else "دخول", fontWeight = FontWeight.Black)
                }
            }
        }
    }
}

@Composable private fun EmployeeWorkspace(vm: NativeMainViewModel, services: NativeServicesViewModel) {
    val context = LocalContext.current
    var section by remember { mutableIntStateOf(0) }
    var utility by remember { mutableStateOf<String?>(null) }
    var menuOpen by remember { mutableStateOf(false) }
    var profileOpen by remember { mutableStateOf(false) }
    var scanner by remember { mutableStateOf(false) }
    var clockType by remember { mutableStateOf("check-in") }
    var requestOpen by remember { mutableStateOf(false) }
    val locationAllowed = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    val cameraAllowed = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
    val permissions = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
        if (result[Manifest.permission.ACCESS_FINE_LOCATION] == true && result[Manifest.permission.CAMERA] == true) scanner = true
    }
    LaunchedEffect(Unit) { vm.refresh(); services.load() }
    LaunchedEffect(section) { if (section == 3) vm.refreshRequests() }
    if (scanner) {
        QrScanner(onResult = { code -> scanner = false; vm.clock(clockType, code, true) }, onCancel = { scanner = false })
        return
    }
    Surface(Modifier.fillMaxSize(), color = SiteBg) {
        Scaffold(containerColor = SiteBg, bottomBar = { BottomToolbar(utility, { menuOpen = !menuOpen; utility = null }, { utility = it; menuOpen = false }) }) { padding ->
            LazyColumn(Modifier.fillMaxSize().padding(bottom = padding.calculateBottomPadding()), contentPadding = PaddingValues(12.dp, 8.dp, 12.dp, 20.dp), verticalArrangement = Arrangement.spacedBy(13.dp)) {
                item { Header(vm.employee?.name.orEmpty(), profileOpen, { profileOpen = !profileOpen }, { section = it; profileOpen = false }) }
                if (menuOpen) item { MenuCard({ menuOpen = false }, { vm.logout() }) }
                utility?.let { key -> item { UtilityCard(key, services) { utility = null } } }
                item { Text("HADIR · EMPLOYEE", color = SiteMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 2.sp, modifier = Modifier.padding(horizontal = 4.dp)); Text(sectionTitle(section), color = SiteText, fontSize = 30.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(horizontal = 4.dp)) }
                item {
                    when (section) {
                        0 -> Home(vm, locationAllowed, cameraAllowed, { type -> clockType = type; if (locationAllowed && cameraAllowed) scanner = true else permissions.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.CAMERA)) }, { requestOpen = true })
                        1 -> Center(vm)
                        2 -> History(vm)
                        3 -> Requests(vm, { requestOpen = true })
                        else -> Profile(vm)
                    }
                }
            }
        }
    }
    if (requestOpen) RequestDialog(vm, { requestOpen = false })
}

@Composable private fun Header(name: String, open: Boolean, onOpen: () -> Unit, onSection: (Int) -> Unit) {
    Column {
        Row(Modifier.fillMaxWidth().height(78.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
            Brand()
            Box {
                OutlinedButton(onClick = onOpen, modifier = Modifier.height(56.dp), shape = RoundedCornerShape(15.dp), border = BorderStroke(1.dp, if (open) SiteGreen else SiteBorder), colors = ButtonDefaults.outlinedButtonColors(containerColor = if (open) Color(0xFF123D32) else SiteCard, contentColor = SiteText)) {
                    Row(verticalAlignment = Alignment.CenterVertically) { Avatar(name, 38.dp); Spacer(Modifier.width(8.dp)); Column(horizontalAlignment = Alignment.End) { Text("الملف الشخصي", color = SiteMuted, fontSize = 9.sp); Text(name.ifBlank { "الموظف" }, color = SiteText, fontSize = 11.sp, fontWeight = FontWeight.Black) }; Spacer(Modifier.width(5.dp)); Icon(Icons.Default.ExpandMore, null, Modifier.size(18.dp)) }
                }
                DropdownMenu(expanded = open, onDismissRequest = onOpen, modifier = Modifier.background(SiteCard)) {
                    Text("أقسام الموظف", color = SiteMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(16.dp, 8.dp))
                    listOf("لوحة الموظف" to Icons.Default.GridView, "مركز الموظف" to Icons.Default.Business, "سجل العمل" to Icons.Default.AccessTime, "الطلبات" to Icons.Default.ListAlt, "الملف الشخصي" to Icons.Default.Person).forEachIndexed { i, pair ->
                        DropdownMenuItem(text = { Text(pair.first, color = SiteText, fontWeight = FontWeight.Bold) }, leadingIcon = { Icon(pair.second, null, tint = SiteGreen) }, onClick = { onSection(i) })
                    }
                }
            }
        }
        HorizontalDivider(color = SiteBorder)
    }
}

@Composable private fun BottomToolbar(selected: String?, onMenu: () -> Unit, onUtility: (String) -> Unit) {
    NavigationBar(containerColor = SiteCard, contentColor = SiteText) {
        NavigationBarItem(false, onMenu, icon = { Icon(Icons.Default.Menu, null) }, label = { Text("القائمة", fontSize = 10.sp) })
        NavigationBarItem(selected == "notifications", { onUtility("notifications") }, icon = { Icon(Icons.Default.Notifications, null) }, label = { Text("الإشعارات", fontSize = 10.sp) })
        NavigationBarItem(selected == "weather", { onUtility("weather") }, icon = { Icon(Icons.Default.Cloud, null) }, label = { Text("الطقس", fontSize = 10.sp) })
        NavigationBarItem(selected == "prayer", { onUtility("prayer") }, icon = { Icon(Icons.Default.Home, null) }, label = { Text("الصلاة", fontSize = 10.sp) })
        NavigationBarItem(selected == "assistant", { onUtility("assistant") }, icon = { Icon(Icons.Default.AutoAwesome, null) }, label = { Text("المساعد", fontSize = 10.sp) })
    }
}

@Composable private fun MenuCard(close: () -> Unit, logout: () -> Unit) { HudCard { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Column { Text("أدوات النظام", color = SiteMuted, fontSize = 10.sp); Text("القائمة", color = SiteText, fontSize = 18.sp, fontWeight = FontWeight.Black) }; TextButton(close) { Text("إغلاق", color = SiteCyan) } }; Spacer(Modifier.height(8.dp)); OutlinedButton(logout, modifier = Modifier.fillMaxWidth(), border = BorderStroke(1.dp, SiteRed.copy(alpha = .5f)), colors = ButtonDefaults.outlinedButtonColors(contentColor = SiteRed)) { Icon(Icons.Default.Logout, null); Spacer(Modifier.width(6.dp)); Text("تسجيل الخروج") } } }

@Composable private fun UtilityCard(key: String, s: NativeServicesViewModel, close: () -> Unit) { HudCard { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text(utilityTitle(key), color = SiteText, fontSize = 19.sp, fontWeight = FontWeight.Black); IconButton(close) { Icon(Icons.Default.Close, null, tint = SiteMuted) } }; when (key) { "notifications" -> if (s.notifications.isEmpty()) Text("لا توجد إشعارات جديدة", color = SiteMuted) else s.notifications.forEach { n -> Text(n.title, color = SiteText, fontWeight = if (!n.read) FontWeight.Bold else FontWeight.Normal, modifier = Modifier.padding(vertical = 5.dp)); Text(n.body ?: n.message.orEmpty(), color = SiteMuted, fontSize = 11.sp) }; "weather" -> s.weather?.let { Text("${it.temperature.toInt()}° · ${weatherLabel(it.code)}\nالإحساس ${it.feelsLike.toInt()}° · الرياح ${it.wind.toInt()} كم/س", color = SiteText, fontSize = 15.sp) } ?: Text("فعّل الموقع ثم حدّث الخدمات.", color = SiteMuted); "prayer" -> s.prayer?.let { p -> Text("الصلاة القادمة: ${nextPrayer(p)}", color = SiteGreen, fontWeight = FontWeight.Bold); Text("الفجر ${p.fajr}  ·  الظهر ${p.dhuhr}  ·  العصر ${p.asr}  ·  المغرب ${p.maghrib}  ·  العشاء ${p.isha}", color = SiteText, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp)) } ?: Text("تحتاج إلى تفعيل الموقع لحساب المواقيت.", color = SiteMuted); else -> Text("المساعد جاهز. خدمات الموظف تعمل محليًا مع الخادم.", color = SiteText) }; OutlinedButton({ s.load() }, modifier = Modifier.fillMaxWidth().padding(top = 10.dp), border = BorderStroke(1.dp, SiteBorder)) { Icon(Icons.Default.Refresh, null); Spacer(Modifier.width(5.dp)); Text("تحديث الخدمات") } } }

@Composable private fun Home(vm: NativeMainViewModel, location: Boolean, camera: Boolean, clock: (String) -> Unit, request: () -> Unit) { var now by remember { mutableStateOf(Date()) }; LaunchedEffect(Unit) { while (true) { delay(1000); now = Date() } }; val latest = vm.attendance.maxByOrNull { it.timestamp }; val checked = latest?.type == "check-in"; HudCard { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Row(verticalAlignment = Alignment.CenterVertically) { Avatar(vm.employee?.name.orEmpty(), 54.dp); Spacer(Modifier.width(10.dp)); Column { Text("مرحبًا بك", color = SiteMuted, fontSize = 10.sp); Text(vm.employee?.name.orEmpty(), color = SiteText, fontSize = 17.sp, fontWeight = FontWeight.Black); Text(vm.employee?.jobNumber.orEmpty(), color = SiteMuted, fontSize = 10.sp) } }; Column(horizontalAlignment = Alignment.End) { Text(SimpleDateFormat("HH:mm", Locale.US).format(now), color = SiteText, fontSize = 21.sp, fontWeight = FontWeight.Black); Text(SimpleDateFormat("EEEE، dd MMM", Locale("ar")).format(now), color = SiteMuted, fontSize = 10.sp) } }; Spacer(Modifier.height(14.dp)); Status(if (checked) "حاضر" else "غير مسجل", if (checked) SiteGreen else SiteAmber) }; Spacer(Modifier.height(10.dp)); Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) { ClockButton("↑", "تسجيل حضور", SiteCyan, !checked, Modifier.weight(1f), { clock("check-in") }); ClockButton("↓", "تسجيل انصراف", SiteGreen, checked, Modifier.weight(1f), { clock("check-out") }) }; Spacer(Modifier.height(10.dp)); HudCard { Text("ملخص اليوم", color = SiteMuted, fontSize = 10.sp); Text("سجل الدوام", color = SiteText, fontSize = 19.sp, fontWeight = FontWeight.Black); Row(Modifier.fillMaxWidth().padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) { Metric("الحضور", vm.attendance.count { it.type == "check-in" }.toString(), Modifier.weight(1f)); Metric("الانصراف", vm.attendance.count { it.type == "check-out" }.toString(), Modifier.weight(1f)); Metric("السجلات", vm.attendance.size.toString(), Modifier.weight(1f)) } }; Spacer(Modifier.height(10.dp)); HudCard { Text("معلومات الدوام", color = SiteMuted, fontSize = 10.sp); Text("${vm.employee?.workStartTime ?: "09:00"} → ${vm.employee?.workEndTime ?: "16:00"}", color = SiteText, fontSize = 18.sp, fontWeight = FontWeight.Black); Text("${vm.employee?.locationId ?: "المقر الرئيسي"} · ${if (vm.employee?.scheduleType == "ROTATION") "تناوبي" else "ثابت"}", color = SiteMuted, fontSize = 11.sp) }; OutlinedButton(request, modifier = Modifier.fillMaxWidth().height(66.dp), border = BorderStroke(1.dp, SiteCyan.copy(alpha = .45f)), colors = ButtonDefaults.outlinedButtonColors(contentColor = SiteCyan)) { Text("طلب استئذان أو إجازة", fontWeight = FontWeight.Black) }; if (!location || !camera) Text("سيطلب التطبيق صلاحية الموقع والكاميرا عند الضغط على التسجيل.", color = SiteMuted, fontSize = 10.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth()) }

@Composable private fun Center(vm: NativeMainViewModel) { HudCard { Text("مركز الموظف", color = SiteText, fontSize = 21.sp, fontWeight = FontWeight.Black); Text("بطاقتك وملخص التزامك", color = SiteMuted, fontSize = 11.sp); Spacer(Modifier.height(12.dp)); Info("الاسم", vm.employee?.name.orEmpty()); Info("الرقم الوظيفي", vm.employee?.jobNumber.orEmpty()); Info("الحالة", vm.employee?.status ?: "نشط"); Info("نوع الجدول", vm.employee?.scheduleType ?: "ثابت") } }

@Composable private fun History(vm: NativeMainViewModel) { HudCard { Text("سجل العمل", color = SiteText, fontSize = 21.sp, fontWeight = FontWeight.Black); Text("الحضور والانصراف اليومي", color = SiteMuted, fontSize = 11.sp); vm.attendance.sortedByDescending { it.timestamp }.take(30).forEach { r -> Row(Modifier.fillMaxWidth().padding(vertical = 7.dp), horizontalArrangement = Arrangement.SpaceBetween) { Text(if (r.type == "check-in") "حضور" else "انصراف", color = if (r.type == "check-in") SiteCyan else SiteGreen, fontWeight = FontWeight.Bold); Text(timeText(r.timestamp), color = SiteText) } }; if (vm.attendance.isEmpty()) Text("لا توجد سجلات حضور بعد", color = SiteMuted) } }

@Composable private fun Requests(vm: NativeMainViewModel, newRequest: () -> Unit) { HudCard { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) { Text("الطلبات", color = SiteText, fontSize = 21.sp, fontWeight = FontWeight.Black); IconButton(newRequest) { Icon(Icons.Default.Add, null, tint = SiteGreen) } }; if (vm.requests.isEmpty()) Text("لا توجد طلبات", color = SiteMuted) else vm.requests.forEach { r -> Row(Modifier.fillMaxWidth().padding(vertical = 7.dp), horizontalArrangement = Arrangement.SpaceBetween) { Column(Modifier.weight(1f)) { Text(requestLabel(r.type), color = SiteText, fontWeight = FontWeight.Bold); Text(r.reason ?: "بدون سبب", color = SiteMuted, fontSize = 10.sp) }; Text(requestStatus(r.status), color = if (r.status == "approved" || r.status == "confirmed") SiteGreen else SiteAmber, fontSize = 10.sp) } } } }

@Composable private fun Profile(vm: NativeMainViewModel) { HudCard { Row(verticalAlignment = Alignment.CenterVertically) { Avatar(vm.employee?.name.orEmpty(), 70.dp); Spacer(Modifier.width(12.dp)); Column { Text(vm.employee?.name.orEmpty(), color = SiteText, fontSize = 21.sp, fontWeight = FontWeight.Black); Text("الملف الشخصي", color = SiteMuted, fontSize = 11.sp); Text(vm.employee?.jobNumber.orEmpty(), color = SiteCyan, fontSize = 11.sp) } }; Spacer(Modifier.height(14.dp)); Info("المعرف", vm.employee?.id.orEmpty()); Info("الحالة", vm.employee?.status ?: "نشط"); Info("الموقع", vm.employee?.locationId ?: "المقر الرئيسي") } }

@Composable private fun RequestDialog(vm: NativeMainViewModel, close: () -> Unit) { var type by remember { mutableStateOf("permission") }; var reason by remember { mutableStateOf("") }; var start by remember { mutableStateOf("") }; var end by remember { mutableStateOf("") }; AlertDialog(onDismissRequest = close, containerColor = SiteCard, title = { Text("طلب جديد", color = SiteText, fontWeight = FontWeight.Black) }, text = { Column(verticalArrangement = Arrangement.spacedBy(8.dp)) { Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) { listOf("permission" to "استئذان", "leave" to "إجازة", "checkout" to "انصراف").forEach { (id, label) -> FilterChip(type == id, { type = id }, label = { Text(label) }) } }; Field(reason, { reason = it }, "السبب", 2); Field(start, { start = it }, "تاريخ البداية"); Field(end, { end = it }, "تاريخ النهاية") } }, confirmButton = { Button({ vm.addRequest(type, reason, start, end); close() }, colors = ButtonDefaults.buttonColors(containerColor = SiteGreen, contentColor = Color(0xFF06261B))) { Text("إرسال", fontWeight = FontWeight.Black) } }, dismissButton = { TextButton(close) { Text("إلغاء", color = SiteMuted) } }) }

@Composable private fun ClockButton(icon: String, title: String, accent: Color, enabled: Boolean, modifier: Modifier, onClick: () -> Unit) { OutlinedButton(onClick, enabled = enabled, modifier = modifier.height(86.dp), shape = RoundedCornerShape(16.dp), border = BorderStroke(1.dp, accent.copy(alpha = .5f)), colors = ButtonDefaults.outlinedButtonColors(contentColor = accent)) { Column(horizontalAlignment = Alignment.CenterHorizontally) { Text(icon, fontSize = 25.sp, fontWeight = FontWeight.Black); Text(title, fontSize = 13.sp, fontWeight = FontWeight.Black) } } }
@Composable private fun Status(text: String, accent: Color) { Box(Modifier.fillMaxWidth().background(accent.copy(alpha = .07f), RoundedCornerShape(16.dp)).border(1.dp, accent.copy(alpha = .5f), RoundedCornerShape(16.dp)).padding(14.dp)) { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Column { Text("حالة اليوم", color = SiteMuted, fontSize = 10.sp); Text(text, color = SiteText, fontSize = 20.sp, fontWeight = FontWeight.Black) }; Text(text, color = accent, fontWeight = FontWeight.Black) } } }
@Composable private fun Metric(label: String, value: String, modifier: Modifier) { Box(modifier.background(SitePanel, RoundedCornerShape(12.dp)).border(1.dp, SiteBorder, RoundedCornerShape(12.dp)).padding(10.dp)) { Text(label, color = SiteMuted, fontSize = 9.sp); Text(value, color = SiteText, fontSize = 18.sp, fontWeight = FontWeight.Black) } }
@Composable private fun Info(label: String, value: String) { Row(Modifier.fillMaxWidth().padding(vertical = 5.dp), horizontalArrangement = Arrangement.SpaceBetween) { Text(label, color = SiteMuted, fontSize = 10.sp); Text(value.ifBlank { "—" }, color = SiteText, fontSize = 11.sp, fontWeight = FontWeight.Bold) } }
@Composable private fun HudCard(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) { Column(modifier.fillMaxWidth().background(SiteCard, RoundedCornerShape(18.dp)).border(1.dp, SiteBorder, RoundedCornerShape(18.dp)).padding(15.dp), content = content) }
@Composable private fun Brand() { Row(verticalAlignment = Alignment.CenterVertically) { Box(Modifier.size(34.dp).background(SitePanel, RoundedCornerShape(10.dp)).border(1.dp, SiteGreen.copy(alpha = .5f), RoundedCornerShape(10.dp)), contentAlignment = Alignment.Center) { Text("H", color = SiteGreen, fontWeight = FontWeight.Black) }; Spacer(Modifier.width(7.dp)); Column { Text("HADIR", color = SiteText, fontSize = 16.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp); Text("حاضر", color = SiteMuted, fontSize = 8.sp) } } }
@Composable private fun Avatar(name: String, size: Dp) { Box(Modifier.size(size).background(SitePanel, CircleShape).border(1.dp, SiteGreen.copy(alpha = .65f), CircleShape), contentAlignment = Alignment.Center) { Text(name.firstOrNull()?.toString() ?: "م", color = SiteGreen, fontSize = (size.value / 2.5f).sp, fontWeight = FontWeight.Black) } }
@Composable private fun Field(value: String, onChange: (String) -> Unit, label: String, minLines: Int = 1) { OutlinedTextField(value, onChange, Modifier.fillMaxWidth(), label = { Text(label) }, minLines = minLines, singleLine = minLines == 1, colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = SiteGreen, unfocusedBorderColor = SiteBorder, focusedLabelColor = SiteGreen, unfocusedLabelColor = SiteMuted, cursorColor = SiteGreen, focusedTextColor = SiteText, unfocusedTextColor = SiteText)) }
private fun sectionTitle(i: Int) = listOf("لوحة الموظف", "مركز الموظف", "سجل العمل", "الطلبات", "الملف الشخصي").getOrElse(i) { "لوحة الموظف" }
private fun utilityTitle(k: String) = mapOf("notifications" to "الإشعارات", "weather" to "الطقس", "prayer" to "مواقيت الصلاة", "assistant" to "المساعد الذكي")[k] ?: k
private fun timeText(v: String) = runCatching { SimpleDateFormat("HH:mm", Locale.US).format(SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.US).parse(v) ?: Date()) }.getOrElse { v.takeLast(5) }
private fun requestLabel(v: String) = mapOf("permission" to "استئذان", "leave" to "إجازة", "checkout" to "انصراف")[v] ?: v
private fun requestStatus(v: String) = mapOf("approved" to "معتمد", "confirmed" to "معتمد", "rejected" to "مرفوض", "pending" to "قيد المراجعة")[v] ?: v
private fun weatherLabel(code: Int) = when (code) { 0 -> "صحو"; 1, 2, 3 -> "غائم جزئيًا"; 45, 48 -> "ضباب"; 51, 53, 55, 56, 57 -> "رذاذ"; 61, 63, 65, 66, 67 -> "أمطار"; 71, 73, 75, 77 -> "ثلوج"; 80, 81, 82 -> "زخات"; 95, 96, 99 -> "عواصف"; else -> "طقس متغير" }
private fun nextPrayer(p: PrayerState): String { val now = SimpleDateFormat("HH:mm", Locale.US).format(Date()); return listOf("الفجر" to p.fajr, "الظهر" to p.dhuhr, "العصر" to p.asr, "المغرب" to p.maghrib, "العشاء" to p.isha).firstOrNull { it.second > now }?.let { "${it.first} · ${it.second}" } ?: "الفجر · ${p.fajr}" }
