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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
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
    MaterialTheme(
        colorScheme = darkColorScheme(
            background = SiteBg,
            surface = SiteCard,
            surfaceVariant = SitePanel,
            primary = SiteGreen,
            secondary = SiteCyan,
            error = SiteRed,
            onBackground = SiteText,
            onSurface = SiteText,
            onSurfaceVariant = SiteMuted,
            onPrimary = Color(0xFF06261B),
            outline = SiteBorder
        )
    ) { if (vm.employee == null) EmployeeLogin(vm) else EmployeeWorkspace(vm, services) }
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
                Button(
                    onClick = { vm.login(user, pass) },
                    enabled = user.isNotBlank() && pass.isNotBlank() && !vm.loading,
                    modifier = Modifier.fillMaxWidth().padding(top = 16.dp).height(52.dp),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = SiteGreen, contentColor = Color(0xFF06261B))
                ) { Text(if (vm.loading) "جارٍ الدخول…" else "دخول", fontWeight = FontWeight.Black) }
            }
        }
    }
}

@Composable private fun EmployeeWorkspace(vm: NativeMainViewModel, services: NativeServicesViewModel) {
    val context = LocalContext.current
    var section by remember { mutableIntStateOf(0) }
    var profileOpen by remember { mutableStateOf(false) }
    var utility by remember { mutableStateOf<String?>(null) }
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
    val startClock = {
        if (locationAllowed && cameraAllowed) scanner = true
        else permissions.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.CAMERA))
    }
    Surface(Modifier.fillMaxSize(), color = SiteBg) {
        Scaffold(containerColor = SiteBg, bottomBar = {
            BottomToolbar(section) { target -> section = target; utility = null }
        }) { padding ->
            LazyColumn(
                Modifier.fillMaxSize().padding(bottom = padding.calculateBottomPadding()),
                contentPadding = PaddingValues(start = 14.dp, top = 8.dp, end = 14.dp, bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item { WebsiteHeader(vm.employee?.name.orEmpty(), profileOpen, { profileOpen = !profileOpen }) { section = it; profileOpen = false } }
                item {
                    when (section) {
                        0 -> Home(vm, locationAllowed, cameraAllowed, { type -> clockType = type; startClock() }, { requestOpen = true })
                        1 -> Center(vm) { utility = it }
                        2 -> History(vm)
                        3 -> Requests(vm) { requestOpen = true }
                        else -> Profile(vm) { vm.logout() }
                    }
                }
                utility?.let { key -> item { UtilityCard(key, services) { utility = null } } }
            }
        }
    }
    if (requestOpen) RequestDialog(vm) { requestOpen = false }
}

@Composable private fun WebsiteHeader(name: String, open: Boolean, onOpen: () -> Unit, onSection: (Int) -> Unit) {
    Box(Modifier.fillMaxWidth().padding(top = 2.dp)) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 52.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text("مرحبًا ${name.ifBlank { "بك" }}", color = SiteText, fontSize = 29.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center)
            Text(SimpleDateFormat("EEEE، d MMMM", Locale("ar")).format(Date()), color = SiteMuted, fontSize = 18.sp, modifier = Modifier.padding(top = 2.dp))
        }
        Box(Modifier.align(Alignment.TopEnd)) {
            Surface(onClick = onOpen, modifier = Modifier.size(52.dp), shape = RoundedCornerShape(17.dp), color = if (open) Color(0xFF163C33) else SiteCard, border = BorderStroke(1.dp, if (open) SiteGreen else SiteBorder)) {
                Box(contentAlignment = Alignment.Center) { Avatar(name, 43.dp) }
            }
            DropdownMenu(expanded = open, onDismissRequest = onOpen, modifier = Modifier.background(SiteCard)) {
                Text("أقسام الموظف", color = SiteMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(16.dp, 8.dp))
                listOf(
                    "لوحة الموظف" to Icons.Default.Home,
                    "مركز الموظف" to Icons.Default.Dashboard,
                    "سجل العمل" to Icons.Default.AccessTime,
                    "الطلبات" to Icons.Default.ListAlt,
                    "الملف الشخصي" to Icons.Default.Person
                ).forEachIndexed { i, pair ->
                    DropdownMenuItem(text = { Text(pair.first, color = SiteText, fontWeight = FontWeight.Bold) }, leadingIcon = { Icon(pair.second, null, tint = SiteGreen) }, onClick = { onSection(i) })
                }
            }
        }
    }
}

@Composable private fun BottomToolbar(section: Int, onSection: (Int) -> Unit) {
    NavigationBar(containerColor = SiteCard, contentColor = SiteText, tonalElevation = 0.dp, modifier = Modifier.border(BorderStroke(1.dp, SiteBorder))) {
        listOf(
            Triple(0, Icons.Default.Home, "الرئيسية"),
            Triple(1, Icons.Default.Dashboard, "المركز"),
            Triple(2, Icons.Default.AccessTime, "السجل"),
            Triple(3, Icons.Default.ListAlt, "الطلبات"),
            Triple(4, Icons.Default.Person, "الملف")
        ).forEach { (index, icon, label) ->
            NavigationBarItem(
                selected = section == index,
                onClick = { onSection(index) },
                icon = { Icon(icon, null, Modifier.size(24.dp)) },
                label = { Text(label, fontSize = 9.sp, fontWeight = FontWeight.Bold) },
                colors = NavigationBarItemDefaults.colors(selectedIconColor = SiteGreen, selectedTextColor = SiteGreen, indicatorColor = Color(0xFF123D32), unselectedIconColor = SiteMuted, unselectedTextColor = SiteMuted)
            )
        }
    }
}

@Composable private fun Home(vm: NativeMainViewModel, location: Boolean, camera: Boolean, clock: (String) -> Unit, request: () -> Unit) {
    var now by remember { mutableStateOf(Date()) }
    LaunchedEffect(Unit) { while (true) { delay(1000); now = Date() } }
    val latest = vm.attendance.maxByOrNull { it.timestamp }
    val checked = latest?.type == "check-in"
    val time = SimpleDateFormat("HH:mm:ss", Locale.US).format(now)
    val date = SimpleDateFormat("EEEE، d MMMM", Locale("ar")).format(now)
    val start = vm.employee?.workStartTime ?: "09:00"
    val end = vm.employee?.workEndTime ?: "16:00"
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        HudCard {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column(horizontalAlignment = Alignment.End, modifier = Modifier.weight(1f)) {
                    Text("المناوبة القادمة", color = SiteMuted, fontSize = 12.sp)
                    Text(end, color = SiteText, fontSize = 36.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                    Text(date, color = SiteMuted, fontSize = 14.sp)
                }
                Box(Modifier.size(54.dp).background(Color(0xFF163A31), RoundedCornerShape(17.dp)), contentAlignment = Alignment.Center) {
                    Icon(Icons.Default.Schedule, null, tint = SiteGreen, modifier = Modifier.size(29.dp))
                }
            }
            HorizontalDivider(color = SiteBorder, modifier = Modifier.padding(vertical = 14.dp))
            Column(horizontalAlignment = Alignment.End, modifier = Modifier.fillMaxWidth()) {
                Text(time, color = SiteText, fontSize = 30.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                Text("اليوم · $date", color = SiteText, fontSize = 15.sp, modifier = Modifier.padding(top = 2.dp))
            }
            HorizontalDivider(color = SiteBorder, modifier = Modifier.padding(vertical = 14.dp))
            Text(if (checked) "تم تسجيل الحضور بنجاح. يمكنك تسجيل الانصراف عند نهاية الدوام." else "تنبيه: لم يتم تسجيل الحضور لهذه المناوبة بعد.", color = if (checked) SiteGreen else SiteAmber, fontSize = 14.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.End, modifier = Modifier.fillMaxWidth())
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            ClockButton("↑", "تسجيل حضور", SiteCyan, !checked, Modifier.weight(1f)) { clock("check-in") }
            ClockButton("↓", "تسجيل انصراف", SiteGreen, checked, Modifier.weight(1f)) { clock("check-out") }
        }
        HudCard {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column(horizontalAlignment = Alignment.End, modifier = Modifier.weight(1f)) {
                    Text("ملخص اليوم", color = SiteText, fontSize = 22.sp, fontWeight = FontWeight.Black)
                    HorizontalDivider(color = SiteBorder, modifier = Modifier.padding(top = 8.dp).width(150.dp))
                }
                Box(Modifier.background(SiteAmber.copy(alpha = .12f), RoundedCornerShape(18.dp)).padding(horizontal = 17.dp, vertical = 9.dp)) { Text("اليوم", color = SiteAmber, fontSize = 15.sp, fontWeight = FontWeight.Black) }
            }
            Spacer(Modifier.height(13.dp))
            Row(Modifier.fillMaxWidth().background(SitePanel, RoundedCornerShape(20.dp)).border(1.dp, SiteBorder, RoundedCornerShape(20.dp)).padding(15.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SummaryMetric("وقت الدوام", "$start - $end", Modifier.weight(1f))
                SummaryMetric("الانصراف", "—", Modifier.weight(1f))
                SummaryMetric("الحضور", if (checked) "مسجل" else "—", Modifier.weight(1f))
            }
            Spacer(Modifier.height(10.dp))
            Row(Modifier.fillMaxWidth().background(SitePanel, RoundedCornerShape(18.dp)).border(1.dp, SiteBorder, RoundedCornerShape(18.dp)).padding(14.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column(horizontalAlignment = Alignment.End) {
                    Text("الموقع", color = SiteMuted, fontSize = 11.sp)
                    Text(vm.employee?.locationId ?: "المقر الرئيسي", color = SiteText, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                }
                Icon(Icons.Default.LocationOn, null, tint = SiteCyan, modifier = Modifier.size(25.dp))
            }
        }
        OutlinedButton(onClick = request, modifier = Modifier.fillMaxWidth().height(60.dp), shape = RoundedCornerShape(17.dp), border = BorderStroke(1.dp, SiteAmber.copy(alpha = .45f)), colors = ButtonDefaults.outlinedButtonColors(contentColor = SiteAmber)) { Text("طلب استئذان أو إجازة", fontWeight = FontWeight.Black, fontSize = 15.sp) }
        if (!location || !camera) Text("سيطلب التطبيق صلاحية الموقع والكاميرا عند الضغط على التسجيل.", color = SiteMuted, fontSize = 10.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
    }
}

@Composable private fun Center(vm: NativeMainViewModel, openUtility: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        HudCard {
            Text("مركز الموظف", color = SiteText, fontSize = 22.sp, fontWeight = FontWeight.Black)
            Text("بياناتك وخدماتك اليومية", color = SiteMuted, fontSize = 11.sp, modifier = Modifier.padding(top = 2.dp, bottom = 10.dp))
            Info("الاسم", vm.employee?.name.orEmpty())
            Info("الرقم الوظيفي", vm.employee?.jobNumber.orEmpty())
            Info("الحالة", vm.employee?.status ?: "نشط")
            Info("نوع الجدول", vm.employee?.scheduleType ?: "ثابت")
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            UtilityChip("notifications", "الإشعارات", Icons.Default.Notifications, Modifier.weight(1f), openUtility)
            UtilityChip("weather", "الطقس", Icons.Default.Cloud, Modifier.weight(1f), openUtility)
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            UtilityChip("prayer", "الصلاة", Icons.Default.Schedule, Modifier.weight(1f), openUtility)
            UtilityChip("assistant", "المساعد", Icons.Default.AutoAwesome, Modifier.weight(1f), openUtility)
        }
    }
}

@Composable private fun UtilityChip(key: String, title: String, icon: androidx.compose.ui.graphics.vector.ImageVector, modifier: Modifier, onClick: (String) -> Unit) {
    OutlinedButton(onClick = { onClick(key) }, modifier = modifier.height(58.dp), shape = RoundedCornerShape(15.dp), border = BorderStroke(1.dp, SiteBorder), colors = ButtonDefaults.outlinedButtonColors(contentColor = SiteText)) {
        Icon(icon, null, tint = SiteCyan, modifier = Modifier.size(20.dp)); Spacer(Modifier.width(6.dp)); Text(title, fontSize = 11.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable private fun History(vm: NativeMainViewModel) {
    HudCard {
        Text("سجل العمل", color = SiteText, fontSize = 22.sp, fontWeight = FontWeight.Black)
        Text("الحضور والانصراف اليومي", color = SiteMuted, fontSize = 11.sp, modifier = Modifier.padding(top = 2.dp, bottom = 10.dp))
        vm.attendance.sortedByDescending { it.timestamp }.take(30).forEach { r ->
            Row(Modifier.fillMaxWidth().padding(vertical = 7.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(if (r.type == "check-in") "حضور" else "انصراف", color = if (r.type == "check-in") SiteCyan else SiteGreen, fontWeight = FontWeight.Bold)
                Text(timeText(r.timestamp), color = SiteText)
            }
        }
        if (vm.attendance.isEmpty()) Text("لا توجد سجلات حضور بعد", color = SiteMuted)
    }
}

@Composable private fun Requests(vm: NativeMainViewModel, newRequest: () -> Unit) {
    HudCard {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("الطلبات", color = SiteText, fontSize = 22.sp, fontWeight = FontWeight.Black)
            IconButton(newRequest) { Icon(Icons.Default.Add, null, tint = SiteGreen) }
        }
        if (vm.requests.isEmpty()) Text("لا توجد طلبات", color = SiteMuted) else vm.requests.forEach { r ->
            Row(Modifier.fillMaxWidth().padding(vertical = 7.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                Column(Modifier.weight(1f)) { Text(requestLabel(r.type), color = SiteText, fontWeight = FontWeight.Bold); Text(r.reason ?: "بدون سبب", color = SiteMuted, fontSize = 10.sp) }
                Text(requestStatus(r.status), color = if (r.status == "approved" || r.status == "confirmed") SiteGreen else SiteAmber, fontSize = 10.sp)
            }
        }
    }
}

@Composable private fun Profile(vm: NativeMainViewModel, logout: () -> Unit) {
    HudCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Avatar(vm.employee?.name.orEmpty(), 70.dp); Spacer(Modifier.width(12.dp))
            Column { Text(vm.employee?.name.orEmpty(), color = SiteText, fontSize = 21.sp, fontWeight = FontWeight.Black); Text("الملف الشخصي", color = SiteMuted, fontSize = 11.sp); Text(vm.employee?.jobNumber.orEmpty(), color = SiteCyan, fontSize = 11.sp) }
        }
        Spacer(Modifier.height(14.dp))
        Info("المعرف", vm.employee?.id.orEmpty()); Info("الحالة", vm.employee?.status ?: "نشط"); Info("الموقع", vm.employee?.locationId ?: "المقر الرئيسي")
        Spacer(Modifier.height(10.dp))
        OutlinedButton(logout, modifier = Modifier.fillMaxWidth(), border = BorderStroke(1.dp, SiteRed.copy(alpha = .5f)), colors = ButtonDefaults.outlinedButtonColors(contentColor = SiteRed)) { Icon(Icons.Default.Logout, null); Spacer(Modifier.width(6.dp)); Text("تسجيل الخروج", fontWeight = FontWeight.Bold) }
    }
}

@Composable private fun UtilityCard(key: String, s: NativeServicesViewModel, close: () -> Unit) {
    HudCard {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) { Text(utilityTitle(key), color = SiteText, fontSize = 19.sp, fontWeight = FontWeight.Black); IconButton(close) { Icon(Icons.Default.Close, null, tint = SiteMuted) } }
        when (key) {
            "notifications" -> if (s.notifications.isEmpty()) Text("لا توجد إشعارات جديدة", color = SiteMuted) else s.notifications.forEach { n -> Text(n.title, color = SiteText, fontWeight = if (!n.read) FontWeight.Bold else FontWeight.Normal, modifier = Modifier.padding(vertical = 5.dp)); Text(n.body ?: n.message.orEmpty(), color = SiteMuted, fontSize = 11.sp) }
            "weather" -> s.weather?.let { Text("${it.temperature.toInt()}° · ${weatherLabel(it.code)}\nالإحساس ${it.feelsLike.toInt()}° · الرياح ${it.wind.toInt()} كم/س", color = SiteText, fontSize = 15.sp) } ?: Text("فعّل الموقع ثم حدّث الخدمات.", color = SiteMuted)
            "prayer" -> s.prayer?.let { p -> Text("الصلاة القادمة: ${nextPrayer(p)}", color = SiteGreen, fontWeight = FontWeight.Bold); Text("الفجر ${p.fajr}  ·  الظهر ${p.dhuhr}  ·  العصر ${p.asr}  ·  المغرب ${p.maghrib}  ·  العشاء ${p.isha}", color = SiteText, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp)) } ?: Text("تحتاج إلى تفعيل الموقع لحساب المواقيت.", color = SiteMuted)
            else -> Text("المساعد جاهز. خدمات الموظف تعمل محليًا مع الخادم.", color = SiteText)
        }
        OutlinedButton({ s.load() }, modifier = Modifier.fillMaxWidth().padding(top = 10.dp), border = BorderStroke(1.dp, SiteBorder)) { Icon(Icons.Default.Refresh, null); Spacer(Modifier.width(5.dp)); Text("تحديث الخدمات") }
    }
}

@Composable private fun RequestDialog(vm: NativeMainViewModel, close: () -> Unit) {
    var type by remember { mutableStateOf("permission") }
    var reason by remember { mutableStateOf("") }
    var start by remember { mutableStateOf("") }
    var end by remember { mutableStateOf("") }
    AlertDialog(onDismissRequest = close, containerColor = SiteCard, title = { Text("طلب جديد", color = SiteText, fontWeight = FontWeight.Black) }, text = {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) { listOf("permission" to "استئذان", "leave" to "إجازة", "checkout" to "انصراف").forEach { (id, label) -> FilterChip(type == id, { type = id }, label = { Text(label) }) } }
            Field(reason, { reason = it }, "السبب", 2); Field(start, { start = it }, "تاريخ البداية"); Field(end, { end = it }, "تاريخ النهاية")
        }
    }, confirmButton = { Button({ vm.addRequest(type, reason, start, end); close() }, colors = ButtonDefaults.buttonColors(containerColor = SiteGreen, contentColor = Color(0xFF06261B))) { Text("إرسال", fontWeight = FontWeight.Black) } }, dismissButton = { TextButton(close) { Text("إلغاء", color = SiteMuted) } })
}

@Composable private fun ClockButton(icon: String, title: String, accent: Color, enabled: Boolean, modifier: Modifier, onClick: () -> Unit) {
    OutlinedButton(onClick = onClick, enabled = enabled, modifier = modifier.height(112.dp), shape = RoundedCornerShape(18.dp), border = BorderStroke(1.dp, accent.copy(alpha = .5f)), colors = ButtonDefaults.outlinedButtonColors(contentColor = accent, disabledContentColor = SiteMuted, disabledBorderColor = SiteBorder)) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(icon, fontSize = 28.sp, fontWeight = FontWeight.Black)
            Text(title, fontSize = 16.sp, fontWeight = FontWeight.Black, color = if (enabled) SiteText else SiteMuted)
            Text(if (title.contains("حضور")) "الدوام الآن" else "إنهاء الدوام", fontSize = 10.sp, color = SiteMuted, modifier = Modifier.padding(top = 2.dp))
        }
    }
}

@Composable private fun SummaryMetric(label: String, value: String, modifier: Modifier) {
    Column(modifier.padding(horizontal = 4.dp), horizontalAlignment = Alignment.CenterHorizontally) { Text(label, color = SiteMuted, fontSize = 10.sp, textAlign = TextAlign.Center); Text(value, color = SiteText, fontSize = 13.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 4.dp)) }
}

@Composable private fun Info(label: String, value: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 5.dp), horizontalArrangement = Arrangement.SpaceBetween) { Text(label, color = SiteMuted, fontSize = 10.sp); Text(value.ifBlank { "—" }, color = SiteText, fontSize = 11.sp, fontWeight = FontWeight.Bold) }
}

@Composable private fun HudCard(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Column(modifier.fillMaxWidth().background(Brush.linearGradient(listOf(Color(0xFF18202C), SiteCard, Color(0xFF121925))), RoundedCornerShape(20.dp)).border(1.dp, SiteBorder, RoundedCornerShape(20.dp)).padding(15.dp), content = content)
}

@Composable private fun Brand() {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(34.dp).background(SitePanel, RoundedCornerShape(10.dp)).border(1.dp, SiteGreen.copy(alpha = .5f), RoundedCornerShape(10.dp)), contentAlignment = Alignment.Center) { Text("H", color = SiteGreen, fontWeight = FontWeight.Black) }
        Spacer(Modifier.width(7.dp)); Column { Text("HADIR", color = SiteText, fontSize = 16.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp); Text("حاضر", color = SiteMuted, fontSize = 8.sp) }
    }
}

@Composable private fun Avatar(name: String, size: Dp) {
    Box(Modifier.size(size).clip(CircleShape).background(SitePanel).border(1.dp, SiteGreen.copy(alpha = .65f), CircleShape), contentAlignment = Alignment.Center) { Text(name.firstOrNull()?.toString() ?: "م", color = SiteGreen, fontSize = (size.value / 2.5f).sp, fontWeight = FontWeight.Black) }
}

@Composable private fun Field(value: String, onChange: (String) -> Unit, label: String, minLines: Int = 1) {
    OutlinedTextField(value, onChange, Modifier.fillMaxWidth(), label = { Text(label) }, minLines = minLines, singleLine = minLines == 1, colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = SiteGreen, unfocusedBorderColor = SiteBorder, focusedLabelColor = SiteGreen, unfocusedLabelColor = SiteMuted, cursorColor = SiteGreen, focusedTextColor = SiteText, unfocusedTextColor = SiteText))
}

private fun utilityTitle(k: String) = mapOf("notifications" to "الإشعارات", "weather" to "الطقس", "prayer" to "مواقيت الصلاة", "assistant" to "المساعد الذكي")[k] ?: k
private fun timeText(v: String) = runCatching { SimpleDateFormat("HH:mm", Locale.US).format(SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.US).parse(v) ?: Date()) }.getOrElse { v.takeLast(5) }
private fun requestLabel(v: String) = mapOf("permission" to "استئذان", "leave" to "إجازة", "checkout" to "انصراف")[v] ?: v
private fun requestStatus(v: String) = mapOf("approved" to "معتمد", "confirmed" to "معتمد", "rejected" to "مرفوض", "pending" to "قيد المراجعة")[v] ?: v
private fun weatherLabel(code: Int) = when (code) { 0 -> "صحو"; 1, 2, 3 -> "غائم جزئيًا"; 45, 48 -> "ضباب"; 51, 53, 55, 56, 57 -> "رذاذ"; 61, 63, 65, 66, 67 -> "أمطار"; 71, 73, 75, 77 -> "ثلوج"; 80, 81, 82 -> "زخات"; 95, 96, 99 -> "عواصف"; else -> "طقس متغير" }
private fun nextPrayer(p: PrayerState): String { val now = SimpleDateFormat("HH:mm", Locale.US).format(Date()); return listOf("الفجر" to p.fajr, "الظهر" to p.dhuhr, "العصر" to p.asr, "المغرب" to p.maghrib, "العشاء" to p.isha).firstOrNull { it.second > now }?.let { "${it.first} · ${it.second}" } ?: "الفجر · ${p.fajr}" }
