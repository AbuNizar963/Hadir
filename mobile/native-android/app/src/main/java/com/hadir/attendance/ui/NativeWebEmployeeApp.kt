package com.hadir.attendance.ui

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private val HudBg = Color(0xFF0C1018)
private val HudCard = Color(0xFF171C26)
private val HudCardAlt = Color(0xFF202631)
private val HudBorder = Color(0xFF303744)
private val HudGreen = Color(0xFF35C995)
private val HudCyan = Color(0xFF35C7F2)
private val HudAmber = Color(0xFFE9A52D)
private val HudMuted = Color(0xFFACB4C1)

@Composable
fun NativeWebEmployeeApp(
    vm: NativeMainViewModel = androidx.lifecycle.viewmodel.compose.viewModel(),
    onEmployeeAuthenticated: () -> Unit = {},
    onEmployeeLoggedOut: () -> Unit = {}
) {
    var notified by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { vm.restoreSession() }
    LaunchedEffect(vm.employee) {
        if (vm.employee != null && !notified) {
            notified = true
            onEmployeeAuthenticated()
        } else if (vm.employee == null && notified) {
            notified = false
            onEmployeeLoggedOut()
        }
    }

    if (vm.employee == null) {
        NativeWebLogin(vm)
    } else {
        NativeWebShell(vm)
    }
}

@Composable
private fun NativeWebLogin(vm: NativeMainViewModel) {
    var user by remember { mutableStateOf("") }
    var pass by remember { mutableStateOf("") }
    Surface(color = HudBg, modifier = Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxSize().padding(20.dp), contentAlignment = Alignment.Center) {
            HudCard(modifier = Modifier.fillMaxWidth()) {
                Brand()
                Spacer(Modifier.height(18.dp))
                Text("مرحبًا بك في حاضر", color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.Black)
                Text("تطبيق الموظف للحضور وإدارة يوم العمل", color = HudMuted, modifier = Modifier.padding(top = 6.dp, bottom = 22.dp))
                OutlinedTextField(
                    value = user,
                    onValueChange = { user = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("رقم الموظف") },
                    singleLine = true,
                    colors = webFieldColors()
                )
                OutlinedTextField(
                    value = pass,
                    onValueChange = { pass = it },
                    modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
                    label = { Text("الرمز / كلمة المرور") },
                    singleLine = true,
                    colors = webFieldColors()
                )
                vm.error?.let { Text(it, color = Color(0xFFF05A67), modifier = Modifier.padding(top = 10.dp)) }
                Button(
                    onClick = { vm.login(user, pass) },
                    enabled = user.isNotBlank() && pass.isNotBlank() && !vm.loading,
                    modifier = Modifier.fillMaxWidth().padding(top = 18.dp).height(52.dp),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = HudGreen, contentColor = Color(0xFF06261B))
                ) { Text(if (vm.loading) "جارٍ الدخول…" else "دخول", fontWeight = FontWeight.Black) }
            }
        }
    }
}

@Composable
private fun NativeWebShell(vm: NativeMainViewModel) {
    val context = LocalContext.current
    var tab by remember { mutableIntStateOf(0) }
    var scanner by remember { mutableStateOf(false) }
    var pendingType by remember { mutableStateOf("check-in") }
    var requestDialog by remember { mutableStateOf(false) }
    var menuDialog by remember { mutableStateOf(false) }
    var requestType by remember { mutableStateOf("permission") }
    var requestReason by remember { mutableStateOf("") }
    var requestStart by remember { mutableStateOf("") }
    var requestEnd by remember { mutableStateOf("") }

    val locationAllowed = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    val cameraAllowed = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
        if (result[Manifest.permission.ACCESS_FINE_LOCATION] == true && result[Manifest.permission.CAMERA] == true) scanner = true
    }

    LaunchedEffect(Unit) { vm.refresh() }
    LaunchedEffect(tab) { if (tab == 3) vm.refreshRequests() }

    if (scanner) {
        QrScanner(
            onResult = { code -> scanner = false; vm.clock(pendingType, code, true) },
            onCancel = { scanner = false }
        )
        return
    }

    if (requestDialog) {
        AlertDialog(
            onDismissRequest = { requestDialog = false },
            containerColor = HudCard,
            titleContentColor = Color.White,
            textContentColor = HudMuted,
            title = { Text("طلب جديد", fontWeight = FontWeight.Black) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("اختر نوع الطلب")
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf("permission" to "استئذان", "leave" to "إجازة", "checkout" to "انصراف مبكر").forEach { (id, label) ->
                            FilterChip(selected = requestType == id, onClick = { requestType = id }, label = { Text(label) })
                        }
                    }
                    OutlinedTextField(value = requestReason, onValueChange = { requestReason = it }, modifier = Modifier.fillMaxWidth(), label = { Text("السبب") }, minLines = 2, colors = webFieldColors())
                    OutlinedTextField(value = requestStart, onValueChange = { requestStart = it }, modifier = Modifier.fillMaxWidth(), label = { Text("تاريخ البداية") }, singleLine = true, colors = webFieldColors())
                    OutlinedTextField(value = requestEnd, onValueChange = { requestEnd = it }, modifier = Modifier.fillMaxWidth(), label = { Text("تاريخ النهاية") }, singleLine = true, colors = webFieldColors())
                }
            },
            confirmButton = {
                Button(onClick = { vm.addRequest(requestType, requestReason, requestStart, requestEnd); requestDialog = false; requestReason = "" }, colors = ButtonDefaults.buttonColors(containerColor = HudGreen, contentColor = Color(0xFF06261B))) { Text("إرسال", fontWeight = FontWeight.Bold) }
            },
            dismissButton = { TextButton(onClick = { requestDialog = false }) { Text("إلغاء", color = HudMuted) } }
        )
    }

    if (menuDialog) {
        AlertDialog(
            onDismissRequest = { menuDialog = false },
            containerColor = HudCard,
            title = { Text("القائمة", color = Color.White, fontWeight = FontWeight.Black) },
            text = { Text("إعدادات واجهة الموظف", color = HudMuted) },
            confirmButton = { TextButton(onClick = { menuDialog = false; vm.logout() }) { Text("تسجيل الخروج", color = Color(0xFFF05A67)) } },
            dismissButton = { TextButton(onClick = { menuDialog = false }) { Text("إغلاق", color = HudMuted) } }
        )
    }

    Surface(color = HudBg, modifier = Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize()) {
            WebTopBar(onMenu = { menuDialog = true })
            WebNav(tab = tab, onTab = { tab = it })
            LazyColumn(
                Modifier.fillMaxSize(),
                contentPadding = PaddingValues(start = 12.dp, end = 12.dp, top = 18.dp, bottom = 28.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                item {
                    Column(Modifier.fillMaxWidth().padding(horizontal = 4.dp)) {
                        Text("HADIR · EMPLOYEE", color = HudMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 2.sp)
                        Text(tabTitle(tab), color = Color.White, fontSize = 32.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 2.dp))
                    }
                }
                when (tab) {
                    0 -> webHomeItems(vm, locationAllowed, cameraAllowed, onClock = { type ->
                        pendingType = type
                        if (locationAllowed && cameraAllowed) scanner = true
                        else permissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.CAMERA))
                    }, onRequest = { requestDialog = true })
                    1 -> webHoursItems(vm)
                    2 -> webCenterItems(vm)
                    3 -> webRequestItems(vm, onNew = { requestDialog = true })
                    else -> webAccountItems(vm)
                }
            }
        }
    }
}

@Composable
private fun WebTopBar(onMenu: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().height(74.dp).background(HudBg).padding(horizontal = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Brand()
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            WebUtilityButton(Icons.Default.Menu, "القائمة", onMenu)
            WebUtilityButton(Icons.Default.Notifications, "الإشعارات") {}
            WebUtilityButton(Icons.Default.WbSunny, "الطقس") {}
        }
    }
    HorizontalDivider(color = HudBorder)
}

@Composable
private fun WebUtilityButton(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, onClick: () -> Unit) {
    OutlinedButton(
        onClick = onClick,
        modifier = Modifier.width(82.dp).height(58.dp),
        shape = RoundedCornerShape(14.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, HudBorder),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = HudMuted)
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(icon, null, modifier = Modifier.size(20.dp))
            Text(label, fontSize = 10.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun WebNav(tab: Int, onTab: (Int) -> Unit) {
    val items = listOf(
        0 to ("لوحة الموظف" to Icons.Default.GridView),
        1 to ("سجل العمل" to Icons.Default.AccessTime),
        2 to ("مركز الموظف" to Icons.Default.Business),
        3 to ("الطلبات" to Icons.Default.ListAlt),
        4 to ("الملف الشخصي" to Icons.Default.Person)
    )
    Row(
        Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 8.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(5.dp)
    ) {
        items.forEach { (index, item) ->
            val active = tab == index
            OutlinedButton(
                onClick = { onTab(index) },
                modifier = Modifier.width(if (index == 0) 116.dp else 102.dp).height(62.dp),
                shape = RoundedCornerShape(14.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, if (active) HudGreen else HudBorder),
                colors = ButtonDefaults.outlinedButtonColors(containerColor = if (active) Color(0xFF123D32) else HudBg, contentColor = if (active) HudGreen else HudMuted)
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(item.second, null, modifier = Modifier.size(21.dp))
                    Text(item.first, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
    HorizontalDivider(color = HudBorder)
}

private fun tabTitle(tab: Int) = listOf("لوحة الموظف", "سجل العمل", "مركز الموظف", "الطلبات", "الملف الشخصي")[tab]

private fun webHomeItems(vm: NativeMainViewModel, locationAllowed: Boolean, cameraAllowed: Boolean, onClock: (String) -> Unit, onRequest: () -> Unit): List<Any> = emptyList()

@Composable
private fun HomeContent(vm: NativeMainViewModel, locationAllowed: Boolean, cameraAllowed: Boolean, onClock: (String) -> Unit, onRequest: () -> Unit) {
    val now = remember { mutableStateOf(Date()) }
    LaunchedEffect(Unit) { while (true) { kotlinx.coroutines.delay(1000); now.value = Date() } }
    val latest = vm.attendance.maxByOrNull { it.timestamp }
    val checkedIn = latest?.type == "check-in"
    val status = if (checkedIn) "حاضر" else "متأخر"
    val statusColor = if (checkedIn) HudGreen else HudAmber
    HudCard {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(54.dp).border(1.dp, HudGreen.copy(alpha = .45f), RoundedCornerShape(16.dp)).background(HudCardAlt, RoundedCornerShape(16.dp)), contentAlignment = Alignment.Center) {
                    Text(vm.employee?.name?.firstOrNull()?.toString() ?: "م", color = HudGreen, fontSize = 22.sp, fontWeight = FontWeight.Black)
                }
                Spacer(Modifier.width(10.dp))
                Column {
                    Text("مرحبًا بك", color = HudMuted, fontSize = 11.sp)
                    Text(vm.employee?.name.orEmpty(), color = Color.White, fontSize = 17.sp, fontWeight = FontWeight.Black)
                    Text("${vm.employee?.jobNumber.orEmpty()} · المقر الرئيسي", color = HudMuted, fontSize = 11.sp)
                }
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(SimpleDateFormat("HH:mm", Locale.US).format(now.value), color = Color.White, fontSize = 21.sp, fontWeight = FontWeight.Black)
                Text(SimpleDateFormat("EEEE، dd MMM", Locale("ar" )).format(now.value), color = HudMuted, fontSize = 10.sp)
            }
        }
        Spacer(Modifier.height(16.dp))
        Box(Modifier.fillMaxWidth().border(1.dp, statusColor.copy(alpha = .55f), RoundedCornerShape(18.dp)).background(statusColor.copy(alpha = .07f), RoundedCornerShape(18.dp)).padding(15.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column {
                    Text("حالة اليوم", color = HudMuted, fontSize = 11.sp)
                    Text(status, color = Color.White, fontSize = 21.sp, fontWeight = FontWeight.Black)
                    Text(if (checkedIn) "أنت مسجل حضور الآن." else "لم يتم تسجيل حضور حتى الآن.", color = HudMuted, fontSize = 11.sp, modifier = Modifier.padding(top = 4.dp))
                }
                Surface(color = statusColor.copy(alpha = .15f), shape = RoundedCornerShape(50)) { Text(status, color = statusColor, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 12.dp, vertical = 5.dp)) }
            }
        }
    }
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        ActionCard("↑", "تسجيل حضور", "مسح رمز QR", HudCyan, !checkedIn) { onClock("check-in") }
        ActionCard("↓", "تسجيل انصراف", "إنهاء الدوام الآن", HudGreen, checkedIn) { onClock("check-out") }
    }
    HudCard {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text("ملخص اليوم", color = HudMuted, fontSize = 11.sp); Text("سجل الدوام", color = Color.White, fontSize = 19.sp, fontWeight = FontWeight.Black) }
        Spacer(Modifier.height(12.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            MiniStat("الحضور", vm.attendance.count { it.type == "check-in" }.toString(), Modifier.weight(1f))
            MiniStat("الانصراف", vm.attendance.count { it.type == "check-out" }.toString(), Modifier.weight(1f))
            MiniStat("السجلات", vm.attendance.size.toString(), Modifier.weight(1f))
        }
    }
    HudCard {
        Text("معلومات الدوام", color = HudMuted, fontSize = 11.sp)
        Text("حالتك الحالية", color = Color.White, fontSize = 19.sp, fontWeight = FontWeight.Black)
        Spacer(Modifier.height(12.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            InfoCell("نوع الدوام", if (vm.employee?.scheduleType == "ROTATION") "تناوبي" else "ثابت", Modifier.weight(1f))
            InfoCell("وقت الدوام", "${vm.employee?.workStartTime ?: "09:00"} → ${vm.employee?.workEndTime ?: "16:00"}", Modifier.weight(1f))
        }
        Spacer(Modifier.height(8.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            InfoCell("الموقع", vm.employee?.locationId ?: "المقر الرئيسي", Modifier.weight(1f))
            InfoCell("السجلات", "${vm.attendance.size} سجل", Modifier.weight(1f))
        }
    }
    OutlinedButton(
        onClick = onRequest,
        modifier = Modifier.fillMaxWidth().height(72.dp),
        shape = RoundedCornerShape(18.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, HudCyan.copy(alpha = .4f)),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = HudCyan)
    ) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Column(horizontalAlignment = Alignment.End) { Text("طلب استئذان أو إجازة", fontWeight = FontWeight.Black, fontSize = 17.sp); Text("إرسال طلب للإدارة", color = HudMuted, fontSize = 10.sp) }
            Text("←", fontSize = 25.sp, fontWeight = FontWeight.Black)
        }
    }
    if (!locationAllowed || !cameraAllowed) Text("سيطلب التطبيق صلاحية الموقع والكاميرا عند الضغط على تسجيل الحضور أو الانصراف.", color = HudMuted, fontSize = 10.sp, textAlign = TextAlign.Center)
}

private fun webHomeItems(vm: NativeMainViewModel, locationAllowed: Boolean, cameraAllowed: Boolean, onClock: (String) -> Unit, onRequest: () -> Unit): List<Nothing> = emptyList()

@Composable
private fun webHoursItems(vm: NativeMainViewModel) {
    vm.attendance.groupBy { it.timestamp.take(10) }.toList().sortedByDescending { it.first }.forEach { (day, rows) ->
        HudCard {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text(day, color = Color.White, fontWeight = FontWeight.Black); Text("${rows.size} سجل", color = HudGreen, fontSize = 11.sp) }
            rows.sortedByDescending { it.timestamp }.forEach { row ->
                Row(Modifier.fillMaxWidth().padding(top = 10.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(if (row.type == "check-in") "حضور" else "انصراف", color = HudMuted)
                    Text(timeText(row.timestamp), color = Color.White, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
    if (vm.attendance.isEmpty()) EmptyHud("لا توجد سجلات حضور بعد")
}

@Composable
private fun webCenterItems(vm: NativeMainViewModel) {
    HudCard { Text("بطاقة الموظف", color = HudMuted, fontSize = 11.sp); Text(vm.employee?.name.orEmpty(), color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Black); Text(vm.employee?.jobNumber.orEmpty(), color = HudMuted, modifier = Modifier.padding(top = 3.dp)); Spacer(Modifier.height(14.dp)); InfoCell("نوع الدوام", if (vm.employee?.scheduleType == "ROTATION") "تناوبي" else "ثابت", Modifier.fillMaxWidth()); Spacer(Modifier.height(8.dp)); InfoCell("الموقع", vm.employee?.locationId ?: "المقر الرئيسي", Modifier.fillMaxWidth()) }
    HudCard { Text("ملخص الالتزام", color = HudMuted, fontSize = 11.sp); Text("سجلات الحضور", color = Color.White, fontSize = 19.sp, fontWeight = FontWeight.Black); Text("${vm.attendance.size} سجل محفوظ من الخادم", color = HudMuted, modifier = Modifier.padding(top = 6.dp)) }
}

@Composable
private fun webRequestItems(vm: NativeMainViewModel, onNew: () -> Unit) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) { Column { Text("طلباتي", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Black); Text("الإجازات والاستئذانات والانصراف المبكر", color = HudMuted, fontSize = 11.sp) }; Button(onClick = onNew, colors = ButtonDefaults.buttonColors(containerColor = HudGreen, contentColor = Color(0xFF06261B))) { Text("طلب جديد", fontWeight = FontWeight.Bold) } }
    vm.requests.forEach { request ->
        HudCard {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text(requestTypeLabel(request.type), color = Color.White, fontWeight = FontWeight.Black); Text(statusLabel(request.status), color = if (request.status == "approved" || request.status == "confirmed") HudGreen else HudAmber, fontSize = 11.sp) }
            Text(request.reason ?: "بدون سبب", color = HudMuted, fontSize = 11.sp, modifier = Modifier.padding(top = 7.dp))
        }
    }
    if (vm.requests.isEmpty()) EmptyHud("لا توجد طلبات حتى الآن")
}

@Composable
private fun webAccountItems(vm: NativeMainViewModel) {
    HudCard { Text("الملف الشخصي", color = HudMuted, fontSize = 11.sp); Text(vm.employee?.name.orEmpty(), color = Color.White, fontSize = 23.sp, fontWeight = FontWeight.Black); Text(vm.employee?.jobNumber.orEmpty(), color = HudMuted, modifier = Modifier.padding(top = 4.dp)); Spacer(Modifier.height(16.dp)); InfoCell("المعرف", vm.employee?.id.orEmpty(), Modifier.fillMaxWidth()); Spacer(Modifier.height(8.dp)); InfoCell("الحالة", vm.employee?.status ?: "فعال", Modifier.fillMaxWidth()) }
    Button(onClick = { vm.logout() }, modifier = Modifier.fillMaxWidth().height(52.dp), shape = RoundedCornerShape(14.dp), colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4B151C), contentColor = Color(0xFFFFB4AB))) { Text("تسجيل الخروج", fontWeight = FontWeight.Bold) }
}

@Composable
private fun ActionCard(symbol: String, title: String, subtitle: String, accent: Color, enabled: Boolean, onClick: () -> Unit) {
    OutlinedButton(onClick = onClick, enabled = enabled, modifier = Modifier.weight(1f).height(150.dp), shape = RoundedCornerShape(18.dp), border = androidx.compose.foundation.BorderStroke(1.dp, HudBorder), colors = ButtonDefaults.outlinedButtonColors(containerColor = HudCard, contentColor = Color.White, disabledContentColor = HudMuted)) {
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.End) { Text(symbol, color = accent, fontSize = 30.sp, fontWeight = FontWeight.Black); Spacer(Modifier.height(14.dp)); Text(title, fontSize = 16.sp, fontWeight = FontWeight.Black); Text(subtitle, color = HudMuted, fontSize = 10.sp, modifier = Modifier.padding(top = 4.dp)) }
    }
}

@Composable
private fun MiniStat(label: String, value: String, modifier: Modifier = Modifier) { Box(modifier.border(1.dp, HudBorder, RoundedCornerShape(14.dp)).background(HudCardAlt, RoundedCornerShape(14.dp)).padding(12.dp)) { Column { Text(label, color = HudMuted, fontSize = 10.sp); Text(value, color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 3.dp)) } } }

@Composable
private fun InfoCell(label: String, value: String, modifier: Modifier = Modifier) { Box(modifier.border(1.dp, HudBorder, RoundedCornerShape(14.dp)).background(HudCardAlt, RoundedCornerShape(14.dp)).padding(12.dp)) { Column { Text(label, color = HudMuted, fontSize = 10.sp); Text(value, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 4.dp)) } } }

@Composable
private fun HudCard(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) { Column(modifier.fillMaxWidth().border(1.dp, HudBorder, RoundedCornerShape(20.dp)).background(HudCard.copy(alpha = .96f), RoundedCornerShape(20.dp)).padding(16.dp), content = content) }

@Composable private fun EmptyHud(text: String) { HudCard { Text(text, color = HudMuted, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center) } }

@Composable private fun AvatarFallback(name: String) { Text(name.firstOrNull()?.toString() ?: "م", color = HudGreen, fontWeight = FontWeight.Black) }

private fun timeText(timestamp: String): String = try { SimpleDateFormat("HH:mm", Locale.US).format(SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.US).parse(timestamp) ?: Date()) } catch (_: Exception) { timestamp.takeLast(5) }
private fun requestTypeLabel(type: String) = when (type) { "permission" -> "استئذان"; "leave" -> "إجازة"; "checkout" -> "انصراف مبكر"; else -> type }
private fun statusLabel(status: String) = when (status) { "approved", "confirmed" -> "مقبول"; "rejected" -> "مرفوض"; else -> "قيد المراجعة" }

private fun webFieldColors() = OutlinedTextFieldDefaults.colors(focusedBorderColor = HudGreen, unfocusedBorderColor = HudBorder, focusedLabelColor = HudGreen, unfocusedLabelColor = HudMuted, cursorColor = HudGreen, focusedTextColor = Color.White, unfocusedTextColor = Color.White)

@Composable
private fun webHomeItems(vm: NativeMainViewModel, locationAllowed: Boolean, cameraAllowed: Boolean, onClock: (String) -> Unit, onRequest: () -> Unit) {
    HomeContent(vm, locationAllowed, cameraAllowed, onClock, onRequest)
}
