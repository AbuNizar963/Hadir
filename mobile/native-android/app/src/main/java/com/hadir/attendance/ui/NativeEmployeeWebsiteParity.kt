package com.hadir.attendance.ui

import android.content.Context
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
private val SiteFont = FontFamily.SansSerif

@Composable
fun NativeEmployeeWebsiteParityApp(
    vm: NativeMainViewModel = viewModel(),
    services: NativeServicesViewModel = viewModel(),
    onEmployeeAuthenticated: () -> Unit = {},
    onEmployeeLoggedOut: () -> Unit = {}
) {
    var notified by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { vm.restoreSession() }
    LaunchedEffect(vm.employee) {
        if (vm.employee != null && !notified) { notified = true; onEmployeeAuthenticated() }
        else if (vm.employee == null && notified) { notified = false; onEmployeeLoggedOut() }
    }
    SiteTheme { if (vm.employee == null) SiteLogin(vm) else SiteEmployeeShell(vm, services) }
}

@Composable private fun SiteTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = darkColorScheme(background = SiteBg, surface = SiteCard, surfaceVariant = SitePanel, primary = SiteGreen, secondary = SiteCyan, error = SiteRed, onBackground = SiteText, onSurface = SiteText, onSurfaceVariant = SiteMuted, onPrimary = Color(0xFF06261B), outline = SiteBorder), content = content)
}

@Composable private fun SiteLogin(vm: NativeMainViewModel) {
    var user by remember { mutableStateOf("") }; var pass by remember { mutableStateOf("") }
    Surface(Modifier.fillMaxSize(), color = SiteBg) {
        Box(Modifier.fillMaxSize().padding(18.dp), contentAlignment = Alignment.Center) {
            HudCard(Modifier.widthIn(max = 560.dp)) { SiteBrand(); Spacer(Modifier.height(18.dp)); Text("مرحبًا بك في حاضر", color = SiteText, fontSize = 28.sp, fontWeight = FontWeight.Black); Text("تسجيل الدخول إلى مساحة الموظف", color = SiteMuted, fontSize = 13.sp, modifier = Modifier.padding(top = 5.dp, bottom = 20.dp)); SiteField(user, { user = it }, "رقم الموظف"); Spacer(Modifier.height(10.dp)); SiteField(pass, { pass = it }, "الرمز / كلمة المرور"); vm.error?.let { Text(it, color = SiteRed, fontSize = 12.sp, modifier = Modifier.padding(top = 9.dp)) }; Button(onClick = { vm.login(user, pass) }, enabled = user.isNotBlank() && pass.isNotBlank() && !vm.loading, modifier = Modifier.fillMaxWidth().padding(top = 16.dp).height(52.dp), shape = RoundedCornerShape(14.dp), colors = ButtonDefaults.buttonColors(containerColor = SiteGreen, contentColor = Color(0xFF06261B))) { Text(if (vm.loading) "جارٍ الدخول…" else "دخول", fontWeight = FontWeight.Black) } }
        }
    }
}

@Composable private fun SiteEmployeeShell(vm: NativeMainViewModel, services: NativeServicesViewModel) {
    val context = LocalContext.current
    var section by remember { mutableIntStateOf(0) }; var utility by remember { mutableStateOf<Utility?>(null) }; var menuOpen by remember { mutableStateOf(false) }; var profileOpen by remember { mutableStateOf(false) }; var scanner by remember { mutableStateOf(false) }; var pendingClock by remember { mutableStateOf("check-in") }; var requestOpen by remember { mutableStateOf(false) }; var requestType by remember { mutableStateOf("permission") }; var reason by remember { mutableStateOf("") }; var start by remember { mutableStateOf("") }; var end by remember { mutableStateOf("") }
    val locationAllowed = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    val cameraAllowed = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result -> if (result[Manifest.permission.ACCESS_FINE_LOCATION] == true && result[Manifest.permission.CAMERA] == true) scanner = true }
    LaunchedEffect(Unit) { vm.refresh(); services.load() }; LaunchedEffect(section) { if (section == 3) vm.refreshRequests() }
    if (scanner) { QrScanner(onResult = { code -> scanner = false; vm.clock(pendingClock, code, true) }, onCancel = { scanner = false }); return }
    if (requestOpen) SiteRequestDialog(vm, requestType, { requestType = it }, reason, { reason = it }, start, { start = it }, end, { end = it }) { requestOpen = false; reason = ""; start = ""; end = "" }
    Surface(Modifier.fillMaxSize(), color = SiteBg) {
        Scaffold(containerColor = SiteBg, bottomBar = { SiteBottomBar(utility, { menuOpen = !menuOpen; utility = null }, { utility = it; menuOpen = false }) }) { bottom ->
            Box(Modifier.fillMaxSize().padding(bottom = bottom)) {
                LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(12.dp, 8.dp, 12.dp, 18.dp), verticalArrangement = Arrangement.spacedBy(13.dp)) {
                    item { SiteHeader(vm.employee?.name.orEmpty(), profileOpen, { profileOpen = !profileOpen; menuOpen = false }, { section = it; profileOpen = false }) }
                    if (menuOpen) item { SiteMenu({ vm.logout() }, { menuOpen = false }) }
                    if (utility != null) item { UtilityPanel(utility!!, services, { utility = null }, context) }
                    item { Column(Modifier.padding(horizontal = 4.dp)) { Text("HADIR · EMPLOYEE", color = SiteMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 2.sp); Text(sectionTitle(section), color = SiteText, fontSize = 30.sp, fontWeight = FontWeight.Black) } }
                    when (section) {
                        0 -> item { EmployeeHomeContent(vm, locationAllowed, cameraAllowed, { type -> pendingClock = type; if (locationAllowed && cameraAllowed) scanner = true else permissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.CAMERA)) }, { requestType = "permission"; requestOpen = true }) }
                        1 -> item { EmployeeCenterContent(vm) }
                        2 -> item { EmployeeHistoryContent(vm) }
                        3 -> item { EmployeeRequestsContent(vm) { requestType = "permission"; requestOpen = true } }
                        else -> item { EmployeeProfileContent(vm) }
                    }
                }
            }
        }
    }
}

private enum class Utility { Notifications, Weather, Prayer, Qibla, Assistant }

@Composable private fun SiteHeader(name: String, profileOpen: Boolean, onProfile: () -> Unit, onSection: (Int) -> Unit) {
    Box(Modifier.fillMaxWidth()) { Row(Modifier.fillMaxWidth().height(78.dp).padding(horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) { SiteBrand(); Box { OutlinedButton(onClick = onProfile, modifier = Modifier.height(56.dp), shape = RoundedCornerShape(15.dp), border = BorderStroke(1.dp, if (profileOpen) SiteGreen else SiteBorder), colors = ButtonDefaults.outlinedButtonColors(containerColor = if (profileOpen) Color(0xFF123D32) else SiteCard, contentColor = SiteText)) { Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) { SiteAvatar(name, 38.dp); Column(horizontalAlignment = Alignment.End) { Text("الملف الشخصي", color = SiteMuted, fontSize = 9.sp); Text(name.ifBlank { "الموظف" }, color = SiteText, fontSize = 11.sp, fontWeight = FontWeight.Black) }; Icon(Icons.Default.ExpandMore, null, Modifier.size(18.dp)) } }; DropdownMenu(expanded = profileOpen, onDismissRequest = onProfile, modifier = Modifier.background(SiteCard)) { Text("أقسام الموظف", color = SiteMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)); val nav = listOf("لوحة الموظف" to Icons.Default.GridView, "مركز الموظف" to Icons.Default.Business, "سجل العمل" to Icons.Default.AccessTime, "الطلبات" to Icons.Default.ListAlt, "الملف الشخصي" to Icons.Default.Person); nav.forEachIndexed { i, pair -> DropdownMenuItem(text = { Text(pair.first, color = SiteText, fontWeight = FontWeight.Bold) }, leadingIcon = { Icon(pair.second, null, tint = SiteGreen) }, onClick = { onSection(i) }) } } } }; HorizontalDivider(color = SiteBorder) }
}

@Composable private fun SiteBottomBar(utility: Utility?, onMenu: () -> Unit, onUtility: (Utility) -> Unit) { NavigationBar(containerColor = SiteCard, contentColor = SiteText) { NavigationBarItem(selected = false, onClick = onMenu, icon = { Icon(Icons.Default.Menu, null) }, label = { Text("القائمة", fontSize = 10.sp) }); NavigationBarItem(selected = utility == Utility.Notifications, onClick = { onUtility(Utility.Notifications) }, icon = { Icon(Icons.Default.Notifications, null) }, label = { Text("الإشعارات", fontSize = 10.sp) }); NavigationBarItem(selected = utility == Utility.Weather, onClick = { onUtility(Utility.Weather) }, icon = { Icon(Icons.Default.Cloud, null) }, label = { Text("الطقس", fontSize = 10.sp) }); NavigationBarItem(selected = utility == Utility.Prayer, onClick = { onUtility(Utility.Prayer) }, icon = { Icon(Icons.Default.Home, null) }, label = { Text("الصلاة", fontSize = 10.sp) }); NavigationBarItem(selected = utility == Utility.Assistant, onClick = { onUtility(Utility.Assistant) }, icon = { Icon(Icons.Default.AutoAwesome, null) }, label = { Text("المساعد", fontSize = 10.sp) }) } }

@Composable private fun SiteMenu(onLogout: () -> Unit, onClose: () -> Unit) { HudCard { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) { Column { Text("أدوات النظام", color = SiteMuted, fontSize = 10.sp); Text("القائمة", color = SiteText, fontSize = 18.sp, fontWeight = FontWeight.Black) }; TextButton(onClick = onClose) { Text("إغلاق", color = SiteCyan) } }; Spacer(Modifier.height(8.dp)); Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) { ToolChip("المظهر", Icons.Default.DarkMode) {}; ToolChip("المزامنة", Icons.Default.Refresh) {}; ToolChip("تسجيل الخروج", Icons.Default.Logout, SiteRed, onLogout) } } }
@Composable private fun ToolChip(label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, tint: Color = SiteText, onClick: () -> Unit) { OutlinedButton(onClick = onClick, modifier = Modifier.weight(1f), shape = RoundedCornerShape(12.dp), border = BorderStroke(1.dp, SiteBorder), colors = ButtonDefaults.outlinedButtonColors(contentColor = tint), contentPadding = PaddingValues(8.dp)) { Icon(icon, null, Modifier.size(17.dp)); Spacer(Modifier.width(4.dp)); Text(label, fontSize = 10.sp) } }

@Composable private fun UtilityPanel(utility: Utility, services: NativeServicesViewModel, onClose: () -> Unit, context: Context) { HudCard { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) { Text(utilityTitle(utility), color = SiteText, fontSize = 19.sp, fontWeight = FontWeight.Black); IconButton(onClick = onClose) { Icon(Icons.Default.Close, "إغلاق", tint = SiteMuted) } }; services.error?.let { Text(it, color = SiteRed, fontSize = 11.sp) }; when (utility) { Utility.Notifications -> { if (services.notifications.isEmpty()) Text("لا توجد إشعارات جديدة", color = SiteMuted); services.notifications.forEach { n -> ListItem(colors = ListItemDefaults.colors(containerColor = Color.Transparent), headlineContent = { Text(n.title, color = SiteText, fontWeight = if (!n.read) FontWeight.Bold else FontWeight.Normal) }, supportingContent = { Text(n.body ?: n.message.orEmpty(), color = SiteMuted) }, leadingContent = { Icon(Icons.Default.Notifications, null, tint = if (!n.read) SiteGreen else SiteMuted) }); HorizontalDivider(color = SiteBorder) } }; Utility.Weather -> { val w = services.weather; if (w == null) Text("فعّل الموقع ثم حدّث الخدمات.", color = SiteMuted) else { Text("${w.temperature.toInt()}°", color = SiteText, fontSize = 38.sp, fontWeight = FontWeight.Black); Text(weatherLabelNative(w.code), color = SiteCyan, fontWeight = FontWeight.Bold); Text("الإحساس ${w.feelsLike.toInt()}° · الرياح ${w.wind.toInt()} كم/س", color = SiteMuted, fontSize = 12.sp); Text("الموقع: ${services.city}", color = SiteMuted, fontSize = 11.sp) } }; Utility.Prayer -> PrayerPanel(services); Utility.Qibla -> QiblaPanel(services); Utility.Assistant -> AssistantPanel(services) }; OutlinedButton(onClick = { services.load() }, modifier = Modifier.fillMaxWidth().padding(top = 10.dp), shape = RoundedCornerShape(12.dp), border = BorderStroke(1.dp, SiteBorder)) { Icon(Icons.Default.Refresh, null); Spacer(Modifier.width(5.dp)); Text("تحديث الخدمات") } } }
@Composable private fun PrayerPanel(s: NativeServicesViewModel) { val p=s.prayer; if(p==null) Text("تحتاج إلى تفعيل الموقع لحساب المواقيت.",color=SiteMuted) else { Text("الصلاة القادمة: ${nextPrayerNative(p).first} · ${nextPrayerNative(p).second}",color=SiteGreen,fontWeight=FontWeight.Bold); listOf("الفجر" to p.fajr,"الشروق" to p.sunrise,"الظهر" to p.dhuhr,"العصر" to p.asr,"المغرب" to p.maghrib,"العشاء" to p.isha).forEach{(n,t)->Row(Modifier.fillMaxWidth().padding(top=7.dp),horizontalArrangement=Arrangement.SpaceBetween){Text(n,color=SiteText);Text(t,color=SiteText,fontWeight=FontWeight.Bold)}}; if(p.hijri.isNotBlank())Text("التاريخ الهجري: ${p.hijri}",color=SiteMuted,fontSize=10.sp) } }
@Composable private fun QiblaPanel(s: NativeServicesViewModel) { Text(if(s.qibla==null)"تحتاج إلى تفعيل الموقع." else "اتجاه القبلة ${s.qibla!!.toInt()}° — ${directionNative(s.qibla!!)}",color=SiteCyan,fontWeight=FontWeight.Bold) }
@Composable private fun AssistantPanel(s: NativeServicesViewModel) { val p=s.prayer; val w=s.weather; val unread=s.notifications.count{!it.read}; val answer=when{unread>0->"لديك $unread إشعارًا غير مقروء. راجعها قبل بدء يوم العمل.";p!=null->"الصلاة القادمة ${nextPrayerNative(p).first} عند ${nextPrayerNative(p).second}.";w!=null->"الطقس الحالي ${w.temperature.toInt()}° — ${weatherLabelNative(w.code)}.";else->"المساعد جاهز. فعّل الموقع للحصول على إجابة أدق."}; Text(answer,color=SiteText,fontSize=13.sp); Text("مساعد حاضر · خدمات الموظف",color=SiteMuted,fontSize=10.sp,modifier=Modifier.padding(top=8.dp)) }

@Composable private fun EmployeeHomeContent(vm: NativeMainViewModel, locationAllowed: Boolean, cameraAllowed: Boolean, onClock: (String) -> Unit, onRequest: () -> Unit) { var now by remember{mutableStateOf(Date())}; LaunchedEffect(Unit){while(true){delay(1000);now=Date()}}; val latest=vm.attendance.maxByOrNull{it.timestamp}; val checked=latest?.type=="check-in"; val status=if(checked)"حاضر" else "غير مسجل"; val statusColor=if(checked)SiteGreen else SiteAmber; HudCard{Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=Alignment.Top){Row(verticalAlignment=Alignment.CenterVertically,modifier=Modifier.weight(1f)){SiteAvatar(vm.employee?.name.orEmpty(),54.dp);Spacer(Modifier.width(10.dp));Column{Text("مرحبًا بك",color=SiteMuted,fontSize=10.sp);Text(vm.employee?.name.orEmpty(),color=SiteText,fontSize=17.sp,fontWeight=FontWeight.Black);Text("${vm.employee?.jobNumber.orEmpty()} · ${vm.employee?.locationId ?: "المقر الرئيسي"}",color=SiteMuted,fontSize=10.sp)}};Column(horizontalAlignment=Alignment.End){Text(SimpleDateFormat("HH:mm",Locale.US).format(now),color=SiteText,fontSize=21.sp,fontWeight=FontWeight.Black);Text(SimpleDateFormat("EEE، dd MMM",Locale("ar")).format(now),color=SiteMuted,fontSize=10.sp)}};Spacer(Modifier.height(14.dp));StatusBox(status,statusColor,if(checked)"أنت مسجل حضور الآن." else "جاهز لتسجيل الحضور عبر QR + GPS.")}; Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(10.dp)){ClockAction("↑","تسجيل حضور","مسح رمز QR",SiteCyan,!checked){onClock("check-in")};ClockAction("↓","تسجيل انصراف","إنهاء الدوام",SiteGreen,checked){onClock("check-out")}}; HudCard{Text("ملخص اليوم",color=SiteMuted,fontSize=10.sp);Text("سجل الدوام",color=SiteText,fontSize=19.sp,fontWeight=FontWeight.Black);Spacer(Modifier.height(10.dp));Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(8.dp)){MetricBox("الحضور",vm.attendance.count{it.type=="check-in"}.toString(),Modifier.weight(1f));MetricBox("الانصراف",vm.attendance.count{it.type=="check-out"}.toString(),Modifier.weight(1f));MetricBox("السجلات",vm.attendance.size.toString(),Modifier.weight(1f))}};HudCard{Text("معلومات الدوام",color=SiteMuted,fontSize=10.sp);Text("حالتك الحالية",color=SiteText,fontSize=19.sp,fontWeight=FontWeight.Black);Spacer(Modifier.height(10.dp));InfoRow("نوع الدوام",if(vm.employee?.scheduleType=="ROTATION")"تناوبي" else "ثابت");InfoRow("وقت الدوام","${vm.employee?.workStartTime ?: "09:00"} → ${vm.employee?.workEndTime ?: "16:00"}");InfoRow("الموقع",vm.employee?.locationId ?: "المقر الرئيسي")};OutlinedButton(onClick=onRequest,modifier=Modifier.fillMaxWidth().height(66.dp),shape=RoundedCornerShape(16.dp),border=BorderStroke(1.dp,SiteCyan.copy(alpha=.45f)),colors=ButtonDefaults.outlinedButtonColors(contentColor=SiteCyan)){Column(horizontalAlignment=Alignment.CenterHorizontally){Text("طلب استئذان أو إجازة",fontWeight=FontWeight.Black);Text("إرسال طلب للإدارة",color=SiteMuted,fontSize=10.sp)}};if(!locationAllowed||!cameraAllowed)Text("سيطلب التطبيق صلاحية الموقع والكاميرا عند الضغط على التسجيل.",color=SiteMuted,fontSize=10.sp,textAlign=TextAlign.Center,modifier=Modifier.fillMaxWidth()) }

@Composable private fun EmployeeCenterContent(vm: NativeMainViewModel){HudCard{Text("مركز الموظف",color=SiteText,fontSize=21.sp,fontWeight=FontWeight.Black);Text("بطاقتك وملخص التزامك",color=SiteMuted,fontSize=11.sp);Spacer(Modifier.height(14.dp));InfoRow("الاسم",vm.employee?.name.orEmpty());InfoRow("الرقم الوظيفي",vm.employee?.jobNumber.orEmpty());InfoRow("الحالة",vm.employee?.status?:"نشط");InfoRow("نوع الجدول",vm.employee?.scheduleType?:"ثابت")};HudCard{Text("مؤشرات سريعة",color=SiteMuted,fontSize=10.sp);Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(8.dp)){MetricBox("سجلات الحضور",vm.attendance.size.toString(),Modifier.weight(1f));MetricBox("الطلبات",vm.requests.size.toString(),Modifier.weight(1f))}}}
@Composable private fun EmployeeHistoryContent(vm: NativeMainViewModel){val grouped=vm.attendance.groupBy{it.timestamp.take(10)}.toList().sortedByDescending{it.first};HudCard{Text("سجل العمل",color=SiteText,fontSize=21.sp,fontWeight=FontWeight.Black);Text("الحضور والانصراف اليومي",color=SiteMuted,fontSize=11.sp,modifier=Modifier.padding(bottom=10.dp));if(grouped.isEmpty())Text("لا توجد سجلات حضور بعد",color=SiteMuted);grouped.forEach{(day,rows)->val ins=rows.filter{it.type=="check-in"||it.type=="in"}.minByOrNull{it.timestamp};val outs=rows.filter{it.type=="check-out"||it.type=="out"}.maxByOrNull{it.timestamp};Box(Modifier.fillMaxWidth().padding(vertical=5.dp).border(1.dp,SiteBorder,RoundedCornerShape(13.dp)).background(SitePanel,RoundedCornerShape(13.dp)).padding(12.dp)){Column{Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text(day,color=SiteText,fontWeight=FontWeight.Bold);Text(if(ins!=null&&outs!=null)"مكتمل" else "مفتوح",color=if(outs!=null)SiteGreen else SiteAmber,fontSize=11.sp)};Text("الحضور: ${ins?.let{timeNative(it.timestamp)}?:"—"}",color=SiteMuted,fontSize=11.sp);Text("الانصراف: ${outs?.let{timeNative(it.timestamp)}?:"—"}",color=SiteMuted,fontSize=11.sp);Text("المدة: ${durationNative(ins?.timestamp,outs?.timestamp)}",color=SiteMuted,fontSize=10.sp)}}}}}
@Composable private fun EmployeeRequestsContent(vm: NativeMainViewModel,onRequest:()->Unit){HudCard{Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=Alignment.CenterVertically){Column{Text("الطلبات",color=SiteText,fontSize=21.sp,fontWeight=FontWeight.Black);Text("طلبات الاستئذان والإجازات والانصراف",color=SiteMuted,fontSize=10.sp)};IconButton(onClick=onRequest){Icon(Icons.Default.Add,"طلب جديد",tint=SiteGreen)}};Spacer(Modifier.height(8.dp));if(vm.requests.isEmpty())Text("لا توجد طلبات",color=SiteMuted) else vm.requests.forEach{r->RequestRow(r.type,r.status,r.reason,r.createdAt)}}}
@Composable private fun EmployeeProfileContent(vm: NativeMainViewModel){HudCard{Row(verticalAlignment=Alignment.CenterVertically){SiteAvatar(vm.employee?.name.orEmpty(),70.dp);Spacer(Modifier.width(13.dp));Column{Text(vm.employee?.name.orEmpty(),color=SiteText,fontSize=21.sp,fontWeight=FontWeight.Black);Text("الملف الشخصي",color=SiteMuted,fontSize=11.sp);Text(vm.employee?.jobNumber.orEmpty(),color=SiteCyan,fontSize=11.sp,fontWeight=FontWeight.Bold)}};Spacer(Modifier.height(15.dp));InfoRow("المعرف",vm.employee?.id.orEmpty());InfoRow("المسمى الوظيفي","موظف حاضر");InfoRow("الحالة",vm.employee?.status?:"نشط");InfoRow("الموقع",vm.employee?.locationId?:"المقر الرئيسي")}}

@Composable private fun SiteRequestDialog(vm: NativeMainViewModel,type:String,onType:(String)->Unit,reason:String,onReason:(String)->Unit,start:String,onStart:(String)->Unit,end:String,onEnd:(String)->Unit,onClose:()->Unit){AlertDialog(onDismissRequest=onClose,containerColor=SiteCard,titleContentColor=SiteText,textContentColor=SiteText,title={Text("طلب جديد",fontWeight=FontWeight.Black)},text={Column(verticalArrangement=Arrangement.spacedBy(8.dp)){Row(horizontalArrangement=Arrangement.spacedBy(5.dp)){listOf("permission" to "استئذان","leave" to "إجازة","checkout" to "انصراف").forEach{(id,label)->FilterChip(selected=type==id,onClick={onType(id)},label={Text(label)})}};SiteField(reason,onReason,"السبب",2);if(type=="permission"||type=="leave"){SiteField(start,onStart,"تاريخ البداية");SiteField(end,onEnd,"تاريخ النهاية")}}},confirmButton={Button(onClick={vm.addRequest(type,reason,start,end);onClose()},colors=ButtonDefaults.buttonColors(containerColor=SiteGreen,contentColor=Color(0xFF06261B))){Text("إرسال",fontWeight=FontWeight.Black)}},dismissButton={TextButton(onClick=onClose){Text("إلغاء",color=SiteMuted)}})}
@Composable private fun StatusBox(status:String,color:Color,detail:String){Box(Modifier.fillMaxWidth().border(1.dp,color.copy(alpha=.55f),RoundedCornerShape(17.dp)).background(color.copy(alpha=.07f),RoundedCornerShape(17.dp)).padding(14.dp)){Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=Alignment.CenterVertically){Column{Text("حالة اليوم",color=SiteMuted,fontSize=10.sp);Text(status,color=SiteText,fontSize=18.sp,fontWeight=FontWeight.Black);Text(detail,color=SiteMuted,fontSize=10.sp)};Text(status,color=color,fontWeight=FontWeight.Black,fontSize=12.sp)}}}
@Composable private fun ClockAction(icon:String,title:String,subtitle:String,color:Color,enabled:Boolean,onClick:()->Unit){OutlinedButton(onClick=onClick,enabled=enabled,modifier=Modifier.weight(1f).height(76.dp),shape=RoundedCornerShape(16.dp),border=BorderStroke(1.dp,color.copy(alpha=.5f)),colors=ButtonDefaults.outlinedButtonColors(contentColor=color)){Row(verticalAlignment=Alignment.CenterVertically){Text(icon,fontSize=25.sp,fontWeight=FontWeight.Black);Spacer(Modifier.width(8.dp));Column(horizontalAlignment=Alignment.End){Text(title,fontWeight=FontWeight.Black,fontSize=14.sp);Text(subtitle,color=SiteMuted,fontSize=9.sp)}}}}
@Composable private fun MetricBox(label:String,value:String,modifier:Modifier){Box(modifier.border(1.dp,SiteBorder,RoundedCornerShape(12.dp)).background(SitePanel,RoundedCornerShape(12.dp)).padding(10.dp)){Column{Text(label,color=SiteMuted,fontSize=9.sp);Text(value,color=SiteText,fontSize=19.sp,fontWeight=FontWeight.Black)}}}
@Composable private fun InfoRow(label:String,value:String){Row(Modifier.fillMaxWidth().padding(vertical=5.dp),horizontalArrangement=Arrangement.SpaceBetween){Text(label,color=SiteMuted,fontSize=10.sp);Text(value.ifBlank{"—"},color=SiteText,fontSize=11.sp,fontWeight=FontWeight.Bold,textAlign=TextAlign.End)}}
@Composable private fun RequestRow(type:String,status:String,reason:String?,createdAt:String){Row(Modifier.fillMaxWidth().padding(vertical=8.dp),verticalAlignment=Alignment.Top){Icon(Icons.Default.Description,null,tint=SiteCyan,modifier=Modifier.size(20.dp));Spacer(Modifier.width(8.dp));Column(Modifier.weight(1f)){Text(requestTypeLabel(type),color=SiteText,fontWeight=FontWeight.Bold,fontSize=12.sp);Text(reason.orEmpty().ifBlank{"بدون سبب"},color=SiteMuted,fontSize=10.sp);Text(timeNative(createdAt),color=SiteMuted,fontSize=9.sp)};Text(requestStatusLabel(status),color=requestStatusColor(status),fontWeight=FontWeight.Bold,fontSize=10.sp)}}
@Composable private fun HudCard(modifier:Modifier=Modifier,content:@Composable ColumnScope.()->Unit){Box(modifier.fillMaxWidth().background(SiteCard,RoundedCornerShape(18.dp)).border(1.dp,SiteBorder,RoundedCornerShape(18.dp)).padding(15.dp)){Column(content=content)}}
@Composable private fun SiteBrand(){Row(verticalAlignment=Alignment.CenterVertically){Box(Modifier.size(34.dp).background(SitePanel,RoundedCornerShape(10.dp)).border(1.dp,SiteGreen.copy(alpha=.5f),RoundedCornerShape(10.dp)),contentAlignment=Alignment.Center){Text("H",color=SiteGreen,fontWeight=FontWeight.Black)};Spacer(Modifier.width(7.dp));Column{Text("HADIR",color=SiteText,fontSize=16.sp,fontWeight=FontWeight.Black,letterSpacing=1.sp);Text("حاضر",color=SiteMuted,fontSize=8.sp)}}}
@Composable private fun SiteAvatar(name:String,size:androidx.compose.ui.unit.Dp){Box(Modifier.size(size).clip(CircleShape).background(SitePanel).border(1.dp,SiteGreen.copy(alpha=.65f),CircleShape),contentAlignment=Alignment.Center){Text(name.firstOrNull()?.toString()?:"م",color=SiteGreen,fontSize=(size.value/2.5f).sp,fontWeight=FontWeight.Black)}}
@Composable private fun SiteField(value:String,onValueChange:(String)->Unit,label:String,minLines:Int=1){OutlinedTextField(value=value,onValueChange=onValueChange,modifier=Modifier.fillMaxWidth(),label={Text(label)},minLines=minLines,singleLine=minLines==1,colors=OutlinedTextFieldDefaults.colors(focusedBorderColor=SiteGreen,unfocusedBorderColor=SiteBorder,focusedLabelColor=SiteGreen,unfocusedLabelColor=SiteMuted,cursorColor=SiteGreen,focusedTextColor=SiteText,unfocusedTextColor=SiteText))}
private fun sectionTitle(i:Int)=listOf("لوحة الموظف","مركز الموظف","سجل العمل","الطلبات","الملف الشخصي").getOrElse(i){"لوحة الموظف"}
private fun utilityTitle(u:Utility)=when(u){Utility.Notifications->"الإشعارات";Utility.Weather->"الطقس";Utility.Prayer->"مواقيت الصلاة";Utility.Qibla->"القبلة";Utility.Assistant->"المساعد الذكي"}
private fun requestTypeLabel(t:String)=when(t.lowercase(Locale.US)){"permission"->"استئذان";"leave"->"إجازة";"checkout"->"انصراف";else->t}
private fun requestStatusLabel(s:String)=when(s.lowercase(Locale.US)){"pending"->"قيد المراجعة";"approved","confirmed"->"معتمد";"rejected"->"مرفوض";else->s}
private fun requestStatusColor(s:String)=when(s.lowercase(Locale.US)){"approved","confirmed"->SiteGreen;"rejected"->SiteRed;else->SiteAmber}
private fun timeNative(v:String)=runCatching{SimpleDateFormat("HH:mm",Locale.US).format(SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX",Locale.US).parse(v)?:Date())}.getOrElse{v.take(16).replace('T',' ')}
private fun durationNative(start:String?,end:String?):String{if(start==null)return "—";val a=runCatching{SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX",Locale.US).parse(start)?.time?:0}.getOrDefault(0);val b=runCatching{SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX",Locale.US).parse(end?:"")?.time?:Date().time}.getOrDefault(Date().time);val min=((b-a).coerceAtLeast(0))/60000;return "${min/60}س ${min%60}د"}
private fun nextPrayerNative(p:PrayerState):Pair<String,String>{val now=SimpleDateFormat("HH:mm",Locale.US).format(Date());return listOf("الفجر" to p.fajr,"الظهر" to p.dhuhr,"العصر" to p.asr,"المغرب" to p.maghrib,"العشاء" to p.isha).firstOrNull{it.second>now}?: ("الفجر" to p.fajr)}
private fun directionNative(deg:Double)=when(((deg/45).toInt()+1)%8){0->"شمال";1->"شمال شرق";2->"شرق";3->"جنوب شرق";4->"جنوب";5->"جنوب غرب";6->"غرب";else->"شمال غرب"}
private fun weatherLabelNative(code:Int)=when(code){0->"صحو";1,2,3->"غائم جزئيًا";45,48->"ضباب";51,53,55,56,57->"رذاذ";61,63,65,66,67->"أمطار";71,73,75,77->"ثلوج";80,81,82->"زخات";95,96,99->"عواصف";else->"طقس متغير"}
