package com.hadir.attendance.ui

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.delay
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private val ShotBg = Color(0xFF090D15)
private val ShotCard = Color(0xFF141923)
private val ShotPanel = Color(0xFF191E29)
private val ShotBorder = Color(0xFF29313D)
private val ShotGreen = Color(0xFF35C995)
private val ShotCyan = Color(0xFF35C7F2)
private val ShotAmber = Color(0xFFE9A52D)
private val ShotText = Color(0xFFF3F5F8)
private val ShotMuted = Color(0xFFAEB6C2)

@Composable
fun NativeEmployeeScreenshotApp(vm: NativeMainViewModel = viewModel(), onEmployeeAuthenticated: () -> Unit = {}, onEmployeeLoggedOut: () -> Unit = {}) {
    var announced by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { vm.restoreSession() }
    LaunchedEffect(vm.employee) { if (vm.employee != null && !announced) { announced = true; onEmployeeAuthenticated() }; if (vm.employee == null && announced) { announced = false; onEmployeeLoggedOut() } }
    MaterialTheme(colorScheme = darkColorScheme(background = ShotBg, surface = ShotCard, surfaceVariant = ShotPanel, primary = ShotGreen, secondary = ShotCyan, onBackground = ShotText, onSurface = ShotText, onSurfaceVariant = ShotMuted, outline = ShotBorder)) {
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) { CompositionLocalProvider(LocalTextStyle provides LocalTextStyle.current.copy(textAlign = TextAlign.Right)) { if (vm.employee == null) ScreenshotLogin(vm) else ScreenshotWorkspace(vm) } }
    }
}

@Composable
private fun ScreenshotLogin(vm: NativeMainViewModel) {
    var user by remember { mutableStateOf("") }; var pass by remember { mutableStateOf("") }
    Surface(Modifier.fillMaxSize(), color = ShotBg) { Box(Modifier.fillMaxSize().padding(18.dp), contentAlignment = Alignment.Center) { HudShotCard(Modifier.widthIn(max = 560.dp)) {
        Text("HADIR", color = ShotGreen, fontSize = 15.sp, fontWeight = FontWeight.Black, letterSpacing = 3.sp)
        Text("لوحة الموظف", color = ShotText, fontSize = 30.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 8.dp))
        Text("تسجيل الدخول إلى مساحة الموظف", color = ShotMuted, fontSize = 13.sp, modifier = Modifier.padding(top = 4.dp, bottom = 20.dp))
        OutlinedTextField(user, { user = it }, Modifier.fillMaxWidth(), label = { Text("رقم الموظف") }, singleLine = true); Spacer(Modifier.height(10.dp))
        OutlinedTextField(pass, { pass = it }, Modifier.fillMaxWidth(), label = { Text("الرمز / كلمة المرور") }, singleLine = true)
        vm.error?.let { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp)) }
        Button(onClick = { vm.login(user, pass) }, enabled = user.isNotBlank() && pass.isNotBlank() && !vm.loading, modifier = Modifier.fillMaxWidth().padding(top = 16.dp).height(52.dp), shape = RoundedCornerShape(14.dp), colors = ButtonDefaults.buttonColors(containerColor = ShotGreen, contentColor = Color(0xFF06261B))) { Text(if (vm.loading) "جارٍ الدخول…" else "دخول", fontWeight = FontWeight.Black) }
    } } }
}

@Composable
private fun ScreenshotWorkspace(vm: NativeMainViewModel) {
    val context = LocalContext.current
    var section by remember { mutableIntStateOf(0) }
    var profileOpen by remember { mutableStateOf(false) }
    var requestOpen by remember { mutableStateOf(false) }
    var scanner by remember { mutableStateOf(false) }
    var clockType by remember { mutableStateOf("check-in") }
    var pendingQr by remember { mutableStateOf("") }
    var locating by remember { mutableStateOf(false) }
    val locationAllowed = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    val cameraAllowed = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
    val cameraPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted -> if (granted) scanner = true }
    val locationPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted -> if (granted && pendingQr.isNotBlank()) vm.clock(clockType, pendingQr, true) else locating = false }
    LaunchedEffect(Unit) { vm.refresh() }
    LaunchedEffect(section) { if (section == 3) vm.refreshRequests() }
    LaunchedEffect(vm.working) { if (!vm.working && locating) locating = false }
    if (scanner) {
        QrScanner(onResult = { code -> scanner = false; pendingQr = code.trim(); if (pendingQr.isBlank()) return@QrScanner; locating = true; if (locationAllowed) vm.clock(clockType, pendingQr, true) else locationPermission.launch(Manifest.permission.ACCESS_FINE_LOCATION) }, onCancel = { scanner = false })
        return
    }
    val startClock: (String) -> Unit = { type -> clockType = type; if (cameraAllowed) scanner = true else cameraPermission.launch(Manifest.permission.CAMERA) }
    Box(Modifier.fillMaxSize()) {
        Surface(Modifier.fillMaxSize(), color = ShotBg) {
            Scaffold(containerColor = ShotBg, bottomBar = { ScreenshotBottomBar(section) { section = it; profileOpen = false } }) { padding ->
                LazyColumn(Modifier.fillMaxSize().padding(bottom = padding.calculateBottomPadding()), contentPadding = PaddingValues(start = 14.dp, top = 9.dp, end = 14.dp, bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    item { ScreenshotTopBar(vm.employee?.name.orEmpty(), profileOpen, { profileOpen = !profileOpen }) { section = it; profileOpen = false } }
                    item { when (section) { 0 -> ScreenshotHome(vm, startClock, request = { requestOpen = true }, locationAllowed = locationAllowed, cameraAllowed = cameraAllowed); 1 -> ScreenshotCenter(vm); 2 -> ScreenshotHistory(vm); 3 -> ScreenshotRequests(vm) { requestOpen = true }; else -> ScreenshotProfile(vm) { vm.logout() } } }
                }
            }
        }
        if (locating || vm.working) {
            Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = .42f)), contentAlignment = Alignment.Center) {
                Surface(shape = RoundedCornerShape(18.dp), color = ShotCard, border = BorderStroke(1.dp, ShotBorder), shadowElevation = 10.dp) {
                    Row(Modifier.padding(horizontal = 20.dp, vertical = 16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.5.dp, color = ShotCyan)
                        Column(horizontalAlignment = Alignment.End) { Text("جاري تحديد الموقع…", color = ShotText, fontSize = 15.sp, fontWeight = FontWeight.Black); Text("يتم التحقق من موقعك قبل تسجيل الحضور", color = ShotMuted, fontSize = 10.sp, modifier = Modifier.padding(top = 3.dp)) }
                    }
                }
            }
        }
    }
    if (requestOpen) ScreenshotRequestDialog(vm) { requestOpen = false }
}

@Composable
private fun ScreenshotTopBar(name: String, open: Boolean, onOpen: () -> Unit, onSection: (Int) -> Unit) {
    Column(Modifier.fillMaxWidth()) { Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.End) {
        Column(Modifier.weight(1f).padding(end = 12.dp), horizontalAlignment = Alignment.End) { Text("HADIR  ·  EMPLOYEE", color = ShotMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 2.sp); Text("لوحة الموظف", color = ShotText, fontSize = 35.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 7.dp)) }
        Surface(onClick = onOpen, modifier = Modifier.size(58.dp), shape = RoundedCornerShape(18.dp), color = if (open) Color(0xFF123A31) else ShotCard, border = BorderStroke(1.dp, if (open) ShotGreen else ShotBorder)) { Box(contentAlignment = Alignment.Center) { ScreenshotAvatar(name) } }
    }; HorizontalDivider(color = Color(0xFF1C222C), modifier = Modifier.padding(top = 13.dp)); DropdownMenu(expanded = open, onDismissRequest = onOpen, modifier = Modifier.background(ShotCard)) {
        Text("أقسام الموظف", color = ShotMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(16.dp, 8.dp))
        listOf("لوحة الموظف" to Icons.Default.Home, "مركز الموظف" to Icons.Default.Dashboard, "سجل العمل" to Icons.Default.AccessTime, "الطلبات" to Icons.Default.ListAlt, "الملف الشخصي" to Icons.Default.Person).forEachIndexed { i, item -> DropdownMenuItem(text = { Text(item.first, color = ShotText, fontWeight = FontWeight.Bold) }, leadingIcon = { Icon(item.second, null, tint = ShotGreen) }, onClick = { onSection(i) }) }
    } }
}

@Composable private fun ScreenshotBottomBar(section: Int, onSection: (Int) -> Unit) { NavigationBar(containerColor = ShotCard, tonalElevation = 0.dp, modifier = Modifier.border(1.dp, ShotBorder)) { listOf(Triple(0, Icons.Default.Home, "الرئيسية"), Triple(1, Icons.Default.Dashboard, "المركز"), Triple(2, Icons.Default.AccessTime, "السجل"), Triple(3, Icons.Default.ListAlt, "الطلبات"), Triple(4, Icons.Default.Person, "الملف")).forEach { (index, icon, label) -> NavigationBarItem(selected = section == index, onClick = { onSection(index) }, icon = { Icon(icon, null, Modifier.size(23.dp)) }, label = { Text(label, fontSize = 9.sp, fontWeight = FontWeight.Bold) }, colors = NavigationBarItemDefaults.colors(selectedIconColor = ShotGreen, selectedTextColor = ShotGreen, indicatorColor = Color(0xFF12372E), unselectedIconColor = ShotMuted, unselectedTextColor = ShotMuted)) } } }

@Composable private fun ScreenshotHome(vm: NativeMainViewModel, startClock: (String) -> Unit, request: () -> Unit, locationAllowed: Boolean, cameraAllowed: Boolean) {
    var now by remember { mutableStateOf(Date()) }; LaunchedEffect(Unit) { while (true) { delay(1000); now = Date() } }
    val employee = vm.employee; val latestIn = vm.attendance.filter { it.type == "check-in" || it.type == "in" }.maxByOrNull { it.timestamp }; val latestOut = vm.attendance.filter { it.type == "check-out" || it.type == "out" }.maxByOrNull { it.timestamp }; val latest = vm.attendance.maxByOrNull { it.timestamp }; val checked = latest?.type == "check-in" || latest?.type == "in"; val start = employee?.workStartTime?.takeIf { it.isNotBlank() } ?: "09:00"; val end = employee?.workEndTime?.takeIf { it.isNotBlank() } ?: "09:00"; val today = SimpleDateFormat("EEEE، dd MMMM", Locale("ar")).format(now); val time = SimpleDateFormat("HH:mm", Locale.US).format(now); val attendanceTime = latestIn?.let { displayTime(it.timestamp) } ?: "—"; val worked = durationText(latestIn?.timestamp, latestOut?.timestamp, now, checked); val late = !checked && isAfterStart(now, start); val countdown = shiftCountdown(now, start)
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        HudShotCard { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) { Column(horizontalAlignment = Alignment.End, modifier = Modifier.weight(1f)) { Text("مرحبًا بك", color = ShotMuted, fontSize = 12.sp); Text(employee?.name?.ifBlank { "الموظف" } ?: "الموظف", color = ShotText, fontSize = 25.sp, fontWeight = FontWeight.Black); Text("2000 · ${employee?.locationId?.takeIf { it.isNotBlank() } ?: "المقر الرئيسي"}", color = ShotMuted, fontSize = 13.sp, modifier = Modifier.padding(top = 3.dp)) }; Box(Modifier.size(64.dp).background(Color(0xFF101E1D), RoundedCornerShape(18.dp)).border(1.dp, Color(0xFF1D6255), RoundedCornerShape(18.dp)), contentAlignment = Alignment.Center) { ScreenshotAvatar(employee?.name.orEmpty(), 46.dp) }; Spacer(Modifier.width(12.dp)); Column(horizontalAlignment = Alignment.Start) { Text(time, color = ShotText, fontSize = 31.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp); Text(today, color = ShotMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 3.dp)) } }
            Spacer(Modifier.height(17.dp)); val statusAccent = when { late -> ShotAmber; checked -> ShotGreen; latest?.type == "check-out" || latest?.type == "out" -> ShotCyan; else -> ShotAmber }; val statusLabel = when { late -> "متأخر"; checked -> "حاضر"; latest?.type == "check-out" || latest?.type == "out" -> "منصرف"; else -> "لم يبدأ" }; val statusMessage = when { late -> "تم تسجيل الحضور بعد بداية الفترة."; checked -> "تم تسجيل حضورك بنجاح."; latest?.type == "check-out" || latest?.type == "out" -> "تم تسجيل انصرافك لهذه المناوبة."; else -> "لم يتم تسجيل الحضور لهذه المناوبة بعد." }; Box(Modifier.fillMaxWidth().background(statusAccent.copy(alpha = .10f), RoundedCornerShape(22.dp)).border(1.dp, statusAccent.copy(alpha = .62f), RoundedCornerShape(22.dp)).padding(15.dp)) { Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.End) { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) { Box(Modifier.background(statusAccent.copy(alpha = .17f), RoundedCornerShape(14.dp)).padding(horizontal = 13.dp, vertical = 5.dp)) { Text(statusLabel, color = statusAccent, fontSize = 13.sp, fontWeight = FontWeight.Black) }; Column(horizontalAlignment = Alignment.End) { Text("حالة اليوم", color = ShotMuted, fontSize = 12.sp); Text(statusLabel, color = ShotText, fontSize = 25.sp, fontWeight = FontWeight.Black) } }; Text(statusMessage, color = ShotMuted, fontSize = 13.sp, modifier = Modifier.padding(top = 6.dp)); Text("اليوم في المناوبة", color = ShotMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 2.dp)); Box(Modifier.fillMaxWidth().padding(top = 12.dp).background(Color(0xFF17191D), RoundedCornerShape(17.dp)).padding(horizontal = 14.dp, vertical = 11.dp)) { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) { Text(countdown, color = ShotText, fontSize = 25.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp); Column(horizontalAlignment = Alignment.End) { Text("تنتهي المناوبة خلال", color = ShotMuted, fontSize = 12.sp); Text("المناوبة الحالية", color = ShotText, fontSize = 11.sp, modifier = Modifier.padding(top = 2.dp)) } } } }; if (late) Box(Modifier.fillMaxWidth().padding(top = 9.dp).background(statusAccent.copy(alpha = .09f), RoundedCornerShape(14.dp)).border(1.dp, statusAccent.copy(alpha = .65f), RoundedCornerShape(14.dp)).padding(10.dp)) { Text("تم رصد تأخر عن بداية الفترة.", color = statusAccent, fontSize = 12.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.End, modifier = Modifier.fillMaxWidth()) } }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) { ShotClockButton("↑", "تسجيل انصراف", "إنهاء الدوام الآن", ShotCyan, enabled = checked && !vm.working, modifier = Modifier.weight(1f)) { startClock("check-out") }; ShotClockButton("↓", "تسجيل حضور", "الدوام جارٍ", ShotGreen, enabled = !checked && !vm.working, modifier = Modifier.weight(1f)) { startClock("check-in") } }
        HudShotCard { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) { Box(Modifier.background(Color(0xFF20242B), RoundedCornerShape(15.dp)).padding(horizontal = 12.dp, vertical = 6.dp)) { Text("اليوم", color = ShotText, fontSize = 12.sp) }; Column(horizontalAlignment = Alignment.End) { Text("ملخص اليوم", color = ShotMuted, fontSize = 12.sp); Text("سجل الدوام", color = ShotText, fontSize = 23.sp, fontWeight = FontWeight.Black) } }; Row(Modifier.fillMaxWidth().padding(top = 14.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) { SummaryShot("مدة العمل", worked, Modifier.weight(1f)); SummaryShot("الانصراف", latestOut?.let { displayTime(it.timestamp) } ?: "—", Modifier.weight(1f)); SummaryShot("الحضور", attendanceTime, Modifier.weight(1f)) } }
        HudShotCard { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) { Box(Modifier.background(ShotGreen.copy(alpha = .14f), RoundedCornerShape(15.dp)).padding(horizontal = 11.dp, vertical = 6.dp)) { Text("يوم عمل", color = ShotGreen, fontSize = 12.sp, fontWeight = FontWeight.Bold) }; Column(horizontalAlignment = Alignment.End) { Text("معلومات الدوام", color = ShotMuted, fontSize = 12.sp); Text("حالتك الحالية", color = ShotText, fontSize = 22.sp, fontWeight = FontWeight.Black) } }; val rows = listOf("نوع الدوام" to "تناوبي", "الفترة" to "4 أيام عمل + 4 أيام راحة", "الحالة" to statusLabel, "وقت المناوبة" to "$start → $end", "الموقع" to (employee?.locationId?.takeIf { it.isNotBlank() } ?: "المقر الرئيسي"), "الجهاز" to "📱 هاتف ·•••"); Column(Modifier.padding(top = 13.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { rows.chunked(2).forEach { pair -> Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) { pair.forEach { (label, value) -> InfoShot(label, value, Modifier.weight(1f)) }; if (pair.size == 1) Spacer(Modifier.weight(1f)) } } } }
        OutlinedButton(onClick = request, modifier = Modifier.fillMaxWidth().height(76.dp), shape = RoundedCornerShape(19.dp), border = BorderStroke(1.dp, ShotCyan.copy(alpha = .35f)), colors = ButtonDefaults.outlinedButtonColors(contentColor = ShotCyan)) { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Default.ArrowBack, null, tint = ShotCyan, modifier = Modifier.size(27.dp)); Column(horizontalAlignment = Alignment.End) { Text("طلب استئذان أو إجازة", color = ShotCyan, fontSize = 17.sp, fontWeight = FontWeight.Black); Text("إرسال طلب للإدارة", color = ShotMuted, fontSize = 11.sp, modifier = Modifier.padding(top = 3.dp)) } } }
        if (!locationAllowed || !cameraAllowed) Text("ستُطلب صلاحية الكاميرا، ثم الموقع بعد قراءة QR فقط.", color = ShotMuted, fontSize = 10.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth()); vm.error?.let { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 11.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth()) }
    }
}

@Composable private fun ShotClockButton(symbol: String, title: String, subtitle: String, tint: Color, enabled: Boolean, modifier: Modifier, onClick: () -> Unit) { OutlinedButton(onClick = onClick, enabled = enabled, modifier = modifier.height(126.dp), shape = RoundedCornerShape(21.dp), border = BorderStroke(1.dp, if (enabled) tint.copy(alpha = .30f) else ShotBorder), colors = ButtonDefaults.outlinedButtonColors(contentColor = tint, disabledContentColor = ShotMuted.copy(alpha = .48f))) { Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) { Text(symbol, color = if (enabled) tint else ShotMuted.copy(alpha = .45f), fontSize = 39.sp, fontWeight = FontWeight.Black); Text(title, color = if (enabled) ShotText else ShotMuted.copy(alpha = .55f), fontSize = 18.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 5.dp)); Text(subtitle, color = ShotMuted, fontSize = 11.sp, modifier = Modifier.padding(top = 4.dp)) } } }
@Composable private fun SummaryShot(label: String, value: String, modifier: Modifier) { Box(modifier.background(ShotPanel, RoundedCornerShape(18.dp)).border(1.dp, ShotBorder, RoundedCornerShape(18.dp)).padding(horizontal = 8.dp, vertical = 13.dp)) { Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) { Text(label, color = ShotMuted, fontSize = 11.sp); Text(value, color = ShotText, fontSize = 15.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 5.dp)) } } }
@Composable private fun InfoShot(label: String, value: String, modifier: Modifier) { Box(modifier.background(ShotPanel, RoundedCornerShape(18.dp)).border(1.dp, ShotBorder, RoundedCornerShape(18.dp)).padding(12.dp)) { Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.End) { Text(label, color = ShotMuted, fontSize = 10.sp); Text(value, color = ShotText, fontSize = 13.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.End, modifier = Modifier.padding(top = 5.dp)) } } }
@Composable private fun ScreenshotCenter(vm: NativeMainViewModel) { Column(verticalArrangement = Arrangement.spacedBy(12.dp)) { HudShotCard { Text("مركز الموظف", color = ShotMuted, fontSize = 12.sp); Text("أدوات يوم العمل", color = ShotText, fontSize = 24.sp, fontWeight = FontWeight.Black); Text("الوصول إلى الخدمات المساندة مع الحفاظ على نفس واجهة لوحة الموظف.", color = ShotMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 5.dp)) }; HudShotCard { InfoShot("الحضور اليوم", if (vm.attendance.isEmpty()) "لا يوجد سجل" else "لديك ${vm.attendance.size} سجل", Modifier.fillMaxWidth()); Spacer(Modifier.height(8.dp)); InfoShot("الطلبات المعلقة", vm.requests.count { it.status == "pending" }.toString(), Modifier.fillMaxWidth()) } } }
@Composable private fun ScreenshotHistory(vm: NativeMainViewModel) { Column(verticalArrangement = Arrangement.spacedBy(12.dp)) { HudShotCard { Text("سجل العمل", color = ShotMuted, fontSize = 12.sp); Text("الحضور والانصراف", color = ShotText, fontSize = 24.sp, fontWeight = FontWeight.Black) }; if (vm.attendance.isEmpty()) HudShotCard { Text("لا توجد سجلات حضور بعد", color = ShotMuted) } else vm.attendance.sortedByDescending { it.timestamp }.take(12).forEach { record -> HudShotCard { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text(displayTime(record.timestamp), color = ShotText, fontWeight = FontWeight.Black); Text(if (record.type == "check-in" || record.type == "in") "حضور" else "انصراف", color = if (record.type == "check-in" || record.type == "in") ShotGreen else ShotCyan) } } } } }
@Composable private fun ScreenshotRequests(vm: NativeMainViewModel, open: () -> Unit) { Column(verticalArrangement = Arrangement.spacedBy(12.dp)) { HudShotCard { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) { Text("الطلبات", color = ShotText, fontSize = 24.sp, fontWeight = FontWeight.Black); Text("${vm.requests.size}", color = ShotCyan, fontWeight = FontWeight.Black) }; Spacer(Modifier.height(12.dp)); OutlinedButton(onClick = open, modifier = Modifier.fillMaxWidth()) { Text("طلب استئذان أو إجازة") } }; vm.requests.take(10).forEach { request -> HudShotCard { Text(request.type, color = ShotText, fontWeight = FontWeight.Bold); Text(request.status, color = ShotMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp)) } } } }
@Composable private fun ScreenshotProfile(vm: NativeMainViewModel, logout: () -> Unit) { val e = vm.employee; Column(verticalArrangement = Arrangement.spacedBy(12.dp)) { HudShotCard { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End, verticalAlignment = Alignment.CenterVertically) { ScreenshotAvatar(e?.name.orEmpty(), 64.dp); Spacer(Modifier.width(14.dp)); Column(horizontalAlignment = Alignment.End) { Text(e?.name.orEmpty(), color = ShotText, fontSize = 23.sp, fontWeight = FontWeight.Black); Text("موظف حاضر", color = ShotMuted, fontSize = 12.sp) } } }; HudShotCard { InfoShot("رقم الموظف", e?.id?.toString() ?: "—", Modifier.fillMaxWidth()); Spacer(Modifier.height(8.dp)); InfoShot("الموقع", e?.locationId ?: "المقر الرئيسي", Modifier.fillMaxWidth()) }; Button(onClick = logout, modifier = Modifier.fillMaxWidth().height(52.dp), colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4A1D25), contentColor = Color(0xFFFFAAB2))) { Text("تسجيل الخروج", fontWeight = FontWeight.Black) } } }
@Composable private fun ScreenshotRequestDialog(vm: NativeMainViewModel, close: () -> Unit) { var type by remember { mutableStateOf("permission") }; var reason by remember { mutableStateOf("") }; var start by remember { mutableStateOf("") }; var end by remember { mutableStateOf("") }; AlertDialog(onDismissRequest = close, title = { Text("طلب جديد") }, text = { Column(verticalArrangement = Arrangement.spacedBy(9.dp)) { Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) { listOf("permission" to "استئذان", "leave" to "إجازة", "checkout" to "انصراف").forEach { (id, label) -> FilterChip(selected = type == id, onClick = { type = id }, label = { Text(label) }) } }; OutlinedTextField(reason, { reason = it }, Modifier.fillMaxWidth(), label = { Text("السبب") }, minLines = 2); OutlinedTextField(start, { start = it }, Modifier.fillMaxWidth(), label = { Text("تاريخ البداية (اختياري)") }, singleLine = true); OutlinedTextField(end, { end = it }, Modifier.fillMaxWidth(), label = { Text("تاريخ النهاية (اختياري)") }, singleLine = true) } }, confirmButton = { Button(onClick = { vm.addRequest(type, reason, start, end); close() }) { Text("إرسال") } }, dismissButton = { TextButton(onClick = close) { Text("إلغاء") } }) }
@Composable private fun HudShotCard(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) { Surface(modifier = modifier.fillMaxWidth(), shape = RoundedCornerShape(24.dp), color = ShotCard, border = BorderStroke(1.dp, ShotBorder), tonalElevation = 0.dp) { Column(Modifier.background(Brush.linearGradient(listOf(Color(0xFF171C27), Color(0xFF11161F)))).padding(18.dp), content = content) } }
@Composable private fun ScreenshotAvatar(name: String, size: androidx.compose.ui.unit.Dp = 43.dp) { val initial = name.trim().firstOrNull()?.toString() ?: "م"; Box(Modifier.size(size).background(Color(0xFF102A25), RoundedCornerShape(size / 3)).border(1.dp, Color(0xFF1D6255), RoundedCornerShape(size / 3)), contentAlignment = Alignment.Center) { Text(initial, color = ShotGreen, fontSize = (size.value * .42f).sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center) } }
private fun displayTime(timestamp: String): String = try { val instant = java.time.Instant.parse(timestamp.replace(" ", "T")); SimpleDateFormat("HH:mm", Locale.US).format(Date.from(instant)) } catch (_: Exception) { timestamp.takeLast(5) }
private fun durationText(start: String?, end: String?, now: Date, active: Boolean): String { if (start == null) return "—"; return try { val a = java.time.Instant.parse(start.replace(" ", "T")); val b = if (end != null) java.time.Instant.parse(end.replace(" ", "T")) else if (active) now.toInstant() else null; if (b == null) "—" else { val minutes = java.time.Duration.between(a, b).toMinutes().coerceAtLeast(0); "${minutes / 60} س ${minutes % 60} د" } } catch (_: Exception) { "—" } }
private fun isAfterStart(now: Date, start: String): Boolean = try { val parts = start.split(":"); val target = java.util.Calendar.getInstance().apply { set(java.util.Calendar.HOUR_OF_DAY, parts[0].toInt()); set(java.util.Calendar.MINUTE, parts.getOrElse(1) { "0" }.toInt()); set(java.util.Calendar.SECOND, 0); set(java.util.Calendar.MILLISECOND, 0) }; now.after(target.time) } catch (_: Exception) { false }
private fun shiftCountdown(now: Date, start: String): String = try { val parts = start.split(":"); val target = java.util.Calendar.getInstance().apply { set(java.util.Calendar.HOUR_OF_DAY, parts[0].toInt()); set(java.util.Calendar.MINUTE, parts.getOrElse(1) { "0" }.toInt()); set(java.util.Calendar.SECOND, 0); set(java.util.Calendar.MILLISECOND, 0) }; if (target.time.before(now)) target.add(java.util.Calendar.DAY_OF_YEAR, 1); val seconds = ((target.timeInMillis - now.time) / 1000L).coerceAtLeast(0); "${seconds / 3600}:${(seconds / 60) % 60}:${seconds % 60}" } catch (_: Exception) { "—" }
