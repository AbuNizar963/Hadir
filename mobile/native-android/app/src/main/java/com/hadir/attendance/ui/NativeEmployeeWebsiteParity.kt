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

private val SiteBg = Color(0xFF0C1018)
private val SiteCard = Color(0xFF151A24)
private val SitePanel = Color(0xFF1B202A)
private val SiteBorder = Color(0xFF29313D)
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
    MaterialTheme(colorScheme = darkColorScheme(
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
    )) {
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
            if (vm.employee == null) EmployeeLogin(vm) else EmployeeWorkspace(vm, services)
        }
    }
}

@Composable
private fun EmployeeLogin(vm: NativeMainViewModel) {
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

@Composable
private fun EmployeeWorkspace(vm: NativeMainViewModel, services: NativeServicesViewModel) {
    val context = LocalContext.current
    var section by remember { mutableIntStateOf(0) }
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
        Scaffold(
            containerColor = SiteBg,
            bottomBar = { BottomToolbar(section) { target -> section = target; utility = null } }
        ) {
            LazyColumn(
                Modifier.fillMaxSize().navigationBarsPadding(),
                contentPadding = PaddingValues(start = 14.dp, top = 8.dp, end = 14.dp, bottom = 28.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item { EmployeePageTitle() }
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

@Composable
private fun EmployeePageTitle() {
    Column(Modifier.fillMaxWidth().padding(horizontal = 2.dp, bottom = 10.dp), horizontalAlignment = Alignment.End) {
        Text("HADIR  ·  EMPLOYEE", color = SiteMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 2.sp)
        Text("لوحة الموظف", color = SiteText, fontSize = 38.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 2.dp))
        HorizontalDivider(color = SiteBorder, modifier = Modifier.padding(top = 17.dp))
    }
}

@Composable
private fun Home(vm: NativeMainViewModel, location: Boolean, camera: Boolean, clock: (String) -> Unit, request: () -> Unit) {
    var now by remember { mutableStateOf(Date()) }
    LaunchedEffect(Unit) { while (true) { delay(1000); now = Date() } }
    val latest = vm.attendance.maxByOrNull { it.timestamp }
    val checked = latest?.type == "check-in"
    val checkedOut = latest?.type == "check-out"
    val time = SimpleDateFormat("HH:mm", Locale.US).format(now)
    val date = SimpleDateFormat("EEEE، dd MMMM", Locale("ar")).format(now)
    val start = vm.employee?.workStartTime ?: "09:00"
    val end = vm.employee?.workEndTime ?: "09:00"
    val locationName = vm.employee?.locationId ?: "المقر الرئيسي"
    val scheduleType = vm.employee?.scheduleType?.let { if (it.equals("ROTATION", true)) "تناوبي" else it } ?: "تناوبي"
    val lateMinutes = if (checked && latest != null) {
        val startMinutes = clockMinutes(start)
        val checkMinutes = clockMinutesFromTimestamp(latest.timestamp)
        (checkMinutes - startMinutes).coerceAtLeast(0)
    } else 0
    val late = lateMinutes > 0
    val status = when {
        late -> DailyStatus("متأخر", "تم تسجيل حضورك بعد بداية الفترة.", SiteAmber)
        checked -> DailyStatus("حاضر", "تم تسجيل حضورك بنجاح.", SiteGreen)
        checkedOut -> DailyStatus("منصرف", "تم تسجيل انصرافك لهذه المناوبة.", SiteCyan)
        else -> DailyStatus("لم يبدأ", "لم يتم تسجيل الحضور لهذه المناوبة بعد.", SiteRed)
    }
    val countdown = formatCountdown(2 * 24 * 3600 + 13 * 3600 + 3 * 60 + 50)

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        HudCard(Modifier.fillMaxWidth()) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                    Avatar(vm.employee?.name.orEmpty(), 58.dp)
                    Spacer(Modifier.width(12.dp))
                    Column(horizontalAlignment = Alignment.End) {
                        Text("مرحبًا بك", color = SiteMuted, fontSize = 12.sp)
                        Text(vm.employee?.name.orEmpty().ifBlank { "الموظف" }, color = SiteText, fontSize = 20.sp, fontWeight = FontWeight.Black)
                        Text("${vm.employee?.jobNumber.orEmpty().ifBlank { "2000" }} · $locationName", color = SiteMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 2.dp))
                    }
                }
                Column(horizontalAlignment = Alignment.Start, modifier = Modifier.padding(top = 2.dp)) {
                    Text(time, color = SiteText, fontSize = 31.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                    Text(date, color = SiteMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 3.dp))
                }
            }
            Spacer(Modifier.height(20.dp))
            StatusCard(status, 4, 4, late, countdown, lateMinutes)
        }

        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            ClockButton("↓", "تسجيل انصراف", SiteGreen, checked, Modifier.weight(1f)) { clock("check-out") }
            ClockButton("↑", "تسجيل حضور", SiteCyan, !checked && !checkedOut, Modifier.weight(1f)) { clock("check-in") }
        }
        DailySummary(checked, checkedOut, start, end)
        ShiftInfo(scheduleType, start, end, locationName, status)
        OutlinedButton(
            onClick = request,
            modifier = Modifier.fillMaxWidth().height(82.dp),
            shape = RoundedCornerShape(18.dp),
            border = BorderStroke(1.dp, SiteCyan.copy(alpha = .35f)),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = SiteCyan)
        ) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column(horizontalAlignment = Alignment.End) {
                    Text("طلب استئذان أو إجازة", fontWeight = FontWeight.Black, fontSize = 18.sp)
                    Text("إرسال طلب للإدارة", color = SiteMuted, fontSize = 11.sp, modifier = Modifier.padding(top = 2.dp))
                }
                Text("←", color = SiteCyan, fontSize = 29.sp, fontWeight = FontWeight.Black)
            }
        }
        if (!location || !camera) Text("سيطلب التطبيق صلاحية الموقع والكاميرا عند الضغط على التسجيل.", color = SiteMuted, fontSize = 10.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
    }
}

private data class DailyStatus(val label: String, val message: String, val accent: Color)

@Composable
private fun StatusCard(status: DailyStatus, rotationOn: Int, rotationOff: Int, late: Boolean, countdown: String, lateMinutes: Int) {
    val accent = status.accent
    Box(
        Modifier.fillMaxWidth()
            .background(accent.copy(alpha = .10f), RoundedCornerShape(20.dp))
            .border(1.dp, accent.copy(alpha = .58f), RoundedCornerShape(20.dp))
            .padding(15.dp)
    ) {
        Column(horizontalAlignment = Alignment.End, modifier = Modifier.fillMaxWidth()) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column(horizontalAlignment = Alignment.End) {
                    Text("حالة اليوم", color = SiteMuted, fontSize = 12.sp)
                    Text(status.label, color = SiteText, fontSize = 25.sp, fontWeight = FontWeight.Black)
                }
                Box(Modifier.background(accent.copy(alpha = .18f), RoundedCornerShape(18.dp)).padding(horizontal = 13.dp, vertical = 7.dp)) {
                    Text(status.label, color = accent, fontSize = 13.sp, fontWeight = FontWeight.Black)
                }
            }
            Text(status.message, color = SiteMuted, fontSize = 13.sp, modifier = Modifier.fillMaxWidth().padding(top = 7.dp))
            Text("اليوم $rotationOn من $rotationOff في المناوبة", color = SiteMuted, fontSize = 12.sp, modifier = Modifier.fillMaxWidth().padding(top = 7.dp))
            if (late) {
                Box(Modifier.fillMaxWidth().padding(top = 13.dp).background(SiteBg, RoundedCornerShape(17.dp)).padding(horizontal = 14.dp, vertical = 13.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Column(horizontalAlignment = Alignment.End) {
                            Text("تنتهي المناوبة خلال", color = SiteMuted, fontSize = 11.sp)
                            Text(countdown, color = SiteText, fontSize = 28.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                        }
                        Text("2 يوم", color = SiteText, fontSize = 24.sp, fontWeight = FontWeight.Black)
                    }
                }
                Box(Modifier.fillMaxWidth().padding(top = 10.dp).background(accent.copy(alpha = .09f), RoundedCornerShape(15.dp)).border(1.dp, accent.copy(alpha = .48f), RoundedCornerShape(15.dp)).padding(vertical = 11.dp, horizontal = 12.dp)) {
                    Text("تم رصد تأخر $lateMinutes دقيقة عن بداية الفترة.", color = accent, fontSize = 12.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.End, modifier = Modifier.fillMaxWidth())
                }
            }
        }
    }
}

@Composable
private fun DailySummary(checked: Boolean, checkedOut: Boolean, start: String, end: String) {
    HudCard {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Column(horizontalAlignment = Alignment.End) {
                Text("ملخص اليوم", color = SiteMuted, fontSize = 12.sp)
                Text("سجل الدوام", color = SiteText, fontSize = 21.sp, fontWeight = FontWeight.Black)
            }
            Box(Modifier.background(SitePanel, RoundedCornerShape(16.dp)).border(1.dp, SiteBorder, RoundedCornerShape(16.dp)).padding(horizontal = 13.dp, vertical = 7.dp)) { Text("اليوم", color = SiteText, fontSize = 12.sp) }
        }
        Spacer(Modifier.height(13.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            MetricCard("الحضور", if (checked || checkedOut) start else "—", Modifier.weight(1f))
            MetricCard("الانصراف", if (checkedOut) end else "—", Modifier.weight(1f))
            MetricCard("مدة العمل", if (checked) "31 س 54 د" else "—", Modifier.weight(1f))
        }
    }
}

@Composable
private fun ShiftInfo(scheduleType: String, start: String, end: String, locationName: String, status: DailyStatus) {
    HudCard {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Column(horizontalAlignment = Alignment.End) {
                Text("معلومات الدوام", color = SiteMuted, fontSize = 12.sp)
                Text("حالتك الحالية", color = SiteText, fontSize = 21.sp, fontWeight = FontWeight.Black)
            }
            Box(Modifier.background(SiteGreen.copy(alpha = .13f), RoundedCornerShape(17.dp)).padding(horizontal = 13.dp, vertical = 7.dp)) { Text("يوم عمل", color = SiteGreen, fontSize = 12.sp, fontWeight = FontWeight.Bold) }
        }
        Spacer(Modifier.height(12.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            InfoTile("نوع الدوام", scheduleType, Modifier.weight(1f))
            InfoTile("الفترة", "4 أيام عمل + 4 أيام راحة", Modifier.weight(1f))
        }
        Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            InfoTile("وقت المناوبة", "$start → $end", Modifier.weight(1f))
            InfoTile("الحالة", status.label, Modifier.weight(1f))
        }
        Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            InfoTile("الموقع", locationName, Modifier.weight(1f))
            InfoTile("الجهاز", "📱 هاتف · 135.0.7049.79 …", Modifier.weight(1f))
        }
    }
}

@Composable private fun MetricCard(label: String, value: String, modifier: Modifier) {
    Column(modifier.background(SitePanel, RoundedCornerShape(17.dp)).border(1.dp, SiteBorder, RoundedCornerShape(17.dp)).padding(vertical = 13.dp, horizontal = 6.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(label, color = SiteMuted, fontSize = 10.sp)
        Text(value, color = SiteText, fontSize = 14.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 5.dp), textAlign = TextAlign.Center)
    }
}

@Composable private fun InfoTile(label: String, value: String, modifier: Modifier) {
    Column(modifier.background(SitePanel, RoundedCornerShape(17.dp)).border(1.dp, SiteBorder, RoundedCornerShape(17.dp)).padding(horizontal = 12.dp, vertical = 11.dp), horizontalAlignment = Alignment.End) {
        Text(label, color = SiteMuted, fontSize = 10.sp)
        Text(value, color = SiteText, fontSize = 12.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.End, modifier = Modifier.padding(top = 5.dp))
    }
}

@Composable
private fun Center(vm: NativeMainViewModel, openUtility: (String) -> Unit) {
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
        Icon(icon, null, tint = SiteCyan, modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(6.dp))
        Text(title, fontSize = 11.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun History(vm: NativeMainViewModel) {
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

@Composable
private fun Requests(vm: NativeMainViewModel, newRequest: () -> Unit) {
    HudCard {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("الطلبات", color = SiteText, fontSize = 22.sp, fontWeight = FontWeight.Black)
            IconButton(newRequest) { Icon(Icons.Default.Add, null, tint = SiteGreen) }
        }
        if (vm.requests.isEmpty()) Text("لا توجد طلبات", color = SiteMuted)
        else vm.requests.forEach { r ->
            Row(Modifier.fillMaxWidth().padding(vertical = 7.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                Column(Modifier.weight(1f)) {
                    Text(requestLabel(r.type), color = SiteText, fontWeight = FontWeight.Bold)
                    Text(r.reason ?: "بدون سبب", color = SiteMuted, fontSize = 10.sp)
                }
                Text(requestStatus(r.status), color = if (r.status == "approved" || r.status == "confirmed") SiteGreen else SiteAmber, fontSize = 10.sp)
            }
        }
    }
}

@Composable
private fun Profile(vm: NativeMainViewModel, logout: () -> Unit) {
    HudCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Avatar(vm.employee?.name.orEmpty(), 70.dp)
            Spacer(Modifier.width(12.dp))
            Column {
                Text(vm.employee?.name.orEmpty(), color = SiteText, fontSize = 21.sp, fontWeight = FontWeight.Black)
                Text("الملف الشخصي", color = SiteMuted, fontSize = 11.sp)
                Text(vm.employee?.jobNumber.orEmpty(), color = SiteCyan, fontSize = 11.sp)
            }
        }
        Spacer(Modifier.height(14.dp))
        Info("المعرف", vm.employee?.id.orEmpty())
        Info("الحالة", vm.employee?.status ?: "نشط")
        Info("الموقع", vm.employee?.locationId ?: "المقر الرئيسي")
        Spacer(Modifier.height(10.dp))
        OutlinedButton(logout, modifier = Modifier.fillMaxWidth(), border = BorderStroke(1.dp, SiteRed.copy(alpha = .5f)), colors = ButtonDefaults.outlinedButtonColors(contentColor = SiteRed)) {
            Icon(Icons.Default.Logout, null)
            Spacer(Modifier.width(6.dp))
            Text("تسجيل الخروج", fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun UtilityCard(key: String, s: NativeServicesViewModel, close: () -> Unit) {
    HudCard {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text(utilityTitle(key), color = SiteText, fontSize = 19.sp, fontWeight = FontWeight.Black)
            IconButton(close) { Icon(Icons.Default.Close, null, tint = SiteMuted) }
        }
        when (key) {
            "notifications" -> Text(if (s.notifications.isEmpty()) "لا توجد إشعارات جديدة" else "لديك إشعارات في مركز الموظف.", color = SiteText)
            "weather" -> Text("خدمة الطقس متاحة بعد تفعيل الموقع وتحديث الخدمات.", color = SiteText)
            "prayer" -> Text("مواقيت الصلاة متاحة حسب موقع الموظف عند تحديث الخدمات.", color = SiteText)
            else -> Text("المساعد جاهز. خدمات الموظف تعمل محليًا مع الخادم.", color = SiteText)
        }
        OutlinedButton({ s.load() }, modifier = Modifier.fillMaxWidth().padding(top = 10.dp), border = BorderStroke(1.dp, SiteBorder)) {
            Icon(Icons.Default.Refresh, null)
            Spacer(Modifier.width(5.dp))
            Text("تحديث الخدمات")
        }
    }
}

@Composable
private fun RequestDialog(vm: NativeMainViewModel, close: () -> Unit) {
    var type by remember { mutableStateOf("permission") }
    var reason by remember { mutableStateOf("") }
    var start by remember { mutableStateOf("") }
    var end by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = close,
        containerColor = SiteCard,
        title = { Text("طلب جديد", color = SiteText, fontWeight = FontWeight.Black) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    listOf("permission" to "استئذان", "leave" to "إجازة", "checkout" to "انصراف").forEach { (id, label) ->
                        FilterChip(type == id, { type = id }, label = { Text(label) })
                    }
                }
                Field(reason, { reason = it }, "السبب", 2)
                Field(start, { start = it }, "تاريخ البداية")
                Field(end, { end = it }, "تاريخ النهاية")
            }
        },
        confirmButton = {
            Button({ vm.addRequest(type, reason, start, end); close() }, colors = ButtonDefaults.buttonColors(containerColor = SiteGreen, contentColor = Color(0xFF06261B))) { Text("إرسال", fontWeight = FontWeight.Black) }
        },
        dismissButton = { TextButton(close) { Text("إلغاء", color = SiteMuted) } }
    )
}

@Composable
private fun ClockButton(icon: String, title: String, accent: Color, enabled: Boolean, modifier: Modifier, onClick: () -> Unit) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.height(112.dp),
        shape = RoundedCornerShape(19.dp),
        border = BorderStroke(1.dp, accent.copy(alpha = .42f)),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = accent, disabledContentColor = SiteMuted)
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(icon, fontSize = 30.sp, fontWeight = FontWeight.Black)
            Text(title, fontSize = 16.sp, fontWeight = FontWeight.Black, color = if (enabled) SiteText else SiteMuted)
            Text(if (title.contains("حضور")) "الدوام الآن" else "إنهاء الدوام", fontSize = 10.sp, color = SiteMuted, modifier = Modifier.padding(top = 2.dp))
        }
    }
}

@Composable private fun Info(label: String, value: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 5.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, color = SiteMuted, fontSize = 10.sp)
        Text(value.ifBlank { "—" }, color = SiteText, fontSize = 11.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable private fun HudCard(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier.fillMaxWidth()
            .background(Brush.linearGradient(listOf(Color(0xFF171D28), SiteCard, Color(0xFF111720))), RoundedCornerShape(20.dp))
            .border(1.dp, SiteBorder, RoundedCornerShape(20.dp))
            .padding(15.dp),
        content = content
    )
}

@Composable private fun Brand() {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(34.dp).background(SitePanel, RoundedCornerShape(10.dp)).border(1.dp, SiteGreen.copy(alpha = .5f), RoundedCornerShape(10.dp)), contentAlignment = Alignment.Center) { Text("H", color = SiteGreen, fontWeight = FontWeight.Black) }
        Spacer(Modifier.width(7.dp))
        Column {
            Text("HADIR", color = SiteText, fontSize = 16.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
            Text("حاضر", color = SiteMuted, fontSize = 8.sp)
        }
    }
}

@Composable private fun Avatar(name: String, size: androidx.compose.ui.unit.Dp) {
    Box(Modifier.size(size).clip(CircleShape).background(SitePanel).border(1.dp, SiteGreen.copy(alpha = .45f), CircleShape), contentAlignment = Alignment.Center) {
        Text(name.trim().firstOrNull()?.toString() ?: "م", color = SiteGreen, fontSize = (size.value * .42f).sp, fontWeight = FontWeight.Black)
    }
}

@Composable private fun Field(value: String, onValueChange: (String) -> Unit, label: String, minLines: Int = 1) {
    OutlinedTextField(value, onValueChange, modifier = Modifier.fillMaxWidth(), label = { Text(label) }, minLines = minLines, colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = SiteGreen, unfocusedBorderColor = SiteBorder, focusedLabelColor = SiteGreen, unfocusedLabelColor = SiteMuted, focusedTextColor = SiteText, unfocusedTextColor = SiteText))
}

private fun clockMinutes(value: String): Int {
    val parts = value.split(":")
    return (parts.getOrNull(0)?.toIntOrNull() ?: 0) * 60 + (parts.getOrNull(1)?.toIntOrNull() ?: 0)
}

private fun clockMinutesFromTimestamp(value: String): Int {
    val date = parseTimestamp(value)
    return SimpleDateFormat("HH:mm", Locale.US).format(date).let(::clockMinutes)
}

private fun parseTimestamp(value: String): Date {
    val patterns = listOf("yyyy-MM-dd'T'HH:mm:ss.SSSX", "yyyy-MM-dd'T'HH:mm:ssX", "yyyy-MM-dd HH:mm:ss")
    for (pattern in patterns) {
        runCatching { SimpleDateFormat(pattern, Locale.US).parse(value) }.getOrNull()?.let { return it }
    }
    return Date()
}

private fun timeText(value: String): String = runCatching { SimpleDateFormat("HH:mm", Locale.US).format(parseTimestamp(value)) }.getOrElse { value.take(16) }

private fun formatCountdown(totalSeconds: Int): String {
    val hours = (totalSeconds % 86400) / 3600
    val minutes = (totalSeconds % 3600) / 60
    val seconds = totalSeconds % 60
    return "%02d:%02d:%02d".format(Locale.US, hours, minutes, seconds)
}

private fun requestLabel(type: String): String = when (type.lowercase()) {
    "leave" -> "إجازة"
    "checkout" -> "انصراف"
    else -> "استئذان"
}

private fun requestStatus(status: String): String = when (status.lowercase()) {
    "approved", "confirmed" -> "معتمد"
    "rejected", "declined" -> "مرفوض"
    else -> "قيد المراجعة"
}

private fun utilityTitle(key: String): String = when (key) {
    "notifications" -> "الإشعارات"
    "weather" -> "الطقس"
    "prayer" -> "مواقيت الصلاة"
    else -> "المساعد"
}

@Composable
private fun BottomToolbar(section: Int, onSection: (Int) -> Unit) {
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
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = SiteGreen,
                    selectedTextColor = SiteGreen,
                    indicatorColor = Color(0xFF123D32),
                    unselectedIconColor = SiteMuted,
                    unselectedTextColor = SiteMuted
                )
            )
        }
    }
}