package com.hadir.attendance.ui

import android.Manifest
import android.app.Application
import android.content.pm.PackageManager
import android.location.Location
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
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
import com.hadir.attendance.data.HadirRepository
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.coroutines.resume

class HadirViewModel(application: Application) : AndroidViewModel(application) {
    private val repo = HadirRepository(application)
    private val fusedLocation: FusedLocationProviderClient = LocationServices.getFusedLocationProviderClient(application)

    var loggedIn by mutableStateOf(false); private set
    var employee by mutableStateOf<com.hadir.attendance.data.Employee?>(null); private set
    var attendance by mutableStateOf<List<AttendanceRecord>>(emptyList()); private set
    var loading by mutableStateOf(false); private set
    var attendanceLoading by mutableStateOf(false); private set
    var error by mutableStateOf<String?>(null); private set

    fun login(username: String, password: String) {
        loading = true
        error = null
        viewModelScope.launch {
            try {
                employee = repo.login(username, password)
                loggedIn = true
                attendance = repo.attendance()
            } catch (e: Exception) {
                error = e.message ?: "تعذر تسجيل الدخول"
            } finally {
                loading = false
            }
        }
    }

    fun clock(type: String, qrCode: String, hasLocationPermission: Boolean) {
        if (employee == null || attendanceLoading) return
        attendanceLoading = true
        error = null
        viewModelScope.launch {
            try {
                if (!hasLocationPermission) {
                    error("اسمح للموقع أولًا لتنفيذ تسجيل الحضور.")
                    return@launch
                }
                if (qrCode.isBlank()) {
                    error("امسح QR الخاص بالموقع أولًا.")
                    return@launch
                }
                val location = currentLocation()
                    ?: error("تعذر الحصول على موقعك الحالي. فعّل الموقع وحاول مرة أخرى.")
                val challenge = repo.createChallenge(type, location.latitude, location.longitude, qrCode.trim())
                if (!challenge.ok) error("تعذر إنشاء طلب التحقق.")
                repo.createAttendance(
                    employeeId = employee!!.id,
                    type = type,
                    timestamp = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.US).format(Date()),
                    lat = location.latitude,
                    lng = location.longitude,
                    challengeId = challenge.challengeId
                )
                attendance = repo.attendance()
            } catch (e: Exception) {
                error = e.message ?: "تعذر تسجيل الحضور"
            } finally {
                attendanceLoading = false
            }
        }
    }

    private suspend fun currentLocation(): Location? = suspendCancellableCoroutine { continuation ->
        val tokenSource = CancellationTokenSource()
        continuation.invokeOnCancellation { tokenSource.cancel() }
        fusedLocation.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, tokenSource.token)
            .addOnSuccessListener { continuation.resume(it) }
            .addOnFailureListener { continuation.resume(null) }
    }

    fun clearError() { error = null }

    fun logout() {
        loggedIn = false
        employee = null
        attendance = emptyList()
        error = null
    }
}

@Composable
fun HadirApp(vm: HadirViewModel = viewModel()) {
    if (vm.loggedIn) HomeScreen(vm) else LoginScreen(vm)
}

@Composable
private fun LoginScreen(vm: HadirViewModel) {
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    Scaffold { padding ->
        Box(
            Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).padding(padding),
            contentAlignment = Alignment.Center
        ) {
            Card(
                Modifier.fillMaxWidth().padding(20.dp),
                shape = RoundedCornerShape(28.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Column(Modifier.padding(24.dp)) {
                    BrandMark()
                    Spacer(Modifier.height(18.dp))
                    Text("مرحبًا بك في حاضر", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                    Text("سجّل دخولك لبدء تتبع وقت العمل", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 6.dp, bottom = 22.dp))
                    OutlinedTextField(username, { username = it }, Modifier.fillMaxWidth(), label = { Text("رقم الموظف") }, singleLine = true, shape = RoundedCornerShape(16.dp))
                    OutlinedTextField(password, { password = it }, Modifier.fillMaxWidth().padding(top = 12.dp), label = { Text("الرمز / كلمة المرور") }, visualTransformation = PasswordVisualTransformation(), singleLine = true, shape = RoundedCornerShape(16.dp))
                    vm.error?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 12.dp)) }
                    Button(
                        onClick = { vm.login(username.trim(), password) },
                        enabled = username.isNotBlank() && password.isNotBlank() && !vm.loading,
                        modifier = Modifier.fillMaxWidth().padding(top = 20.dp).height(52.dp),
                        shape = RoundedCornerShape(16.dp)
                    ) { Text(if (vm.loading) "جارٍ الدخول…" else "دخول", fontWeight = FontWeight.Bold) }
                }
            }
        }
    }
}

@Composable
private fun HomeScreen(vm: HadirViewModel) {
    val context = LocalContext.current
    var showPermissionHint by remember { mutableStateOf(false) }
    var showScanner by remember { mutableStateOf(false) }
    var selectedTab by remember { mutableStateOf(0) }
    var pendingType by remember { mutableStateOf("check-in") }
    var scanError by remember { mutableStateOf<String?>(null) }

    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
        showPermissionHint = result.values.any { !it }
    }

    LaunchedEffect(Unit) {
        val missing = arrayOf(Manifest.permission.CAMERA, Manifest.permission.ACCESS_FINE_LOCATION).filter {
            ContextCompat.checkSelfPermission(context, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isNotEmpty()) permissionLauncher.launch(missing.toTypedArray())
    }

    val latest = vm.attendance.sortedByDescending { it.timestamp }.firstOrNull()
    val checkedIn = latest?.type == "check-in"
    val workedEntries = vm.attendance.count { it.type == "check-in" }
    val today = SimpleDateFormat("EEEE، d MMMM", Locale("ar")).format(Date())
    val hasLocationPermission = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED

    if (showScanner) {
        QrScanner(
            onResult = { code ->
                showScanner = false
                scanError = null
                vm.clock(pendingType, code, hasLocationPermission)
            },
            onCancel = {
                showScanner = false
                scanError = null
            }
        )
        return
    }

    LaunchedEffect(vm.attendanceLoading) {
        if (!vm.attendanceLoading && vm.error == null) scanError = null
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            Surface(shadowElevation = 8.dp, color = MaterialTheme.colorScheme.surface) {
                Row(Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 10.dp, vertical = 8.dp), horizontalArrangement = Arrangement.SpaceAround) {
                    BottomItem("الرئيسية", selectedTab == 0) { selectedTab = 0 }
                    BottomItem("ساعاتي", selectedTab == 1) { selectedTab = 1 }
                    BottomItem("الملف", selectedTab == 2) { selectedTab = 2 }
                }
            }
        }
    ) { padding ->
        LazyColumn(
            Modifier.fillMaxSize().padding(padding),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 16.dp, vertical = 18.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            item {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(48.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primaryContainer), contentAlignment = Alignment.Center) {
                            Text(vm.employee?.name?.firstOrNull()?.toString() ?: "م", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold, fontSize = 20.sp)
                        }
                        Spacer(Modifier.width(12.dp))
                        Column {
                            Text("مرحبًا ${vm.employee?.name.orEmpty()}", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                            Text(today, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
                        }
                    }
                    TextButton(onClick = vm::logout) { Text("خروج") }
                }
            }

            item {
                Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(26.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)) {
                    Column(Modifier.padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(if (checkedIn) "أنت تعمل الآن" else "ساعة العمل", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
                        Text(if (checkedIn) "مسجّل حضور" else "غير مسجّل", fontWeight = FontWeight.Bold, fontSize = 22.sp, modifier = Modifier.padding(top = 4.dp))
                        Spacer(Modifier.height(18.dp))
                        Button(
                            onClick = {
                                pendingType = if (checkedIn) "check-out" else "check-in"
                                scanError = null
                                vm.clearError()
                                if (!hasLocationPermission) showPermissionHint = true else showScanner = true
                            },
                            enabled = !vm.attendanceLoading,
                            modifier = Modifier.size(168.dp),
                            shape = CircleShape,
                            contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(if (checkedIn) "انصراف" else "حضور", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 24.sp)
                                Text(if (vm.attendanceLoading) "جارٍ التحقق…" else "امسح QR للمتابعة", color = Color.White.copy(alpha = 0.82f), fontSize = 11.sp, modifier = Modifier.padding(top = 3.dp))
                            }
                        }
                        Text(if (checkedIn) "امسح QR عند انتهاء دوامك" else "يمسح QR ثم يتحقق من GPS قبل التسجيل", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp, modifier = Modifier.padding(top = 14.dp), textAlign = TextAlign.Center)
                        if (showPermissionHint) Text("تحتاج الكاميرا والموقع لتنفيذ التحقق الآمن.", color = MaterialTheme.colorScheme.error, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 10.dp))
                        vm.error?.let { Text(it, color = MaterialTheme.colorScheme.error, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 10.dp)) }
                        scanError?.let { Text(it, color = MaterialTheme.colorScheme.error, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 10.dp)) }
                    }
                }
            }

            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    StatCard("ساعات اليوم", if (checkedIn) "جارية" else "0:00", Modifier.weight(1f))
                    StatCard("سجلات الحضور", workedEntries.toString(), Modifier.weight(1f))
                }
            }

            item {
                Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(22.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                    Column(Modifier.padding(18.dp)) {
                        Text("جدولي اليوم", fontWeight = FontWeight.Bold, fontSize = 17.sp)
                        Spacer(Modifier.height(12.dp))
                        ScheduleRow("الدوام", "09:00 — 17:00")
                        HorizontalDivider(Modifier.padding(vertical = 10.dp))
                        ScheduleRow("الموقع", "الموقع المخصص")
                    }
                }
            }

            item { Text("آخر النشاطات", fontWeight = FontWeight.Bold, fontSize = 17.sp, modifier = Modifier.padding(top = 2.dp)) }
            if (vm.attendance.isEmpty()) item { EmptyActivity() }
            else items(vm.attendance.sortedByDescending { it.timestamp }.take(5)) { record -> ActivityRow(record) }
        }
    }
}

@Composable
private fun BrandMark() {
    Box(Modifier.size(52.dp).clip(RoundedCornerShape(16.dp)).background(MaterialTheme.colorScheme.primary), contentAlignment = Alignment.Center) {
        Text("ح", color = Color.White, fontSize = 25.sp, fontWeight = FontWeight.Black)
    }
}

@Composable
private fun BottomItem(label: String, selected: Boolean, onClick: () -> Unit) {
    TextButton(onClick = onClick, modifier = Modifier.width(96.dp)) {
        Text(label, color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant, fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal)
    }
}

@Composable
private fun StatCard(label: String, value: String, modifier: Modifier = Modifier) {
    Card(modifier, shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.padding(16.dp)) {
            Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
            Text(value, fontWeight = FontWeight.Bold, fontSize = 22.sp, modifier = Modifier.padding(top = 5.dp))
        }
    }
}

@Composable
private fun ScheduleRow(label: String, value: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun EmptyActivity() {
    Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.55f))) {
        Text("لا توجد سجلات حضور بعد.", modifier = Modifier.fillMaxWidth().padding(22.dp), textAlign = TextAlign.Center, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun ActivityRow(record: AttendanceRecord) {
    val isIn = record.type == "check-in"
    Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Column {
                Text(if (isIn) "حضور" else "انصراف", fontWeight = FontWeight.Bold)
                Text(record.timestamp, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp, modifier = Modifier.padding(top = 3.dp))
            }
            Text(if (isIn) "دخول" else "خروج", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
        }
    }
}
